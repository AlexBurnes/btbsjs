const Module  = '/h3ml/sbin/setup.js';
const Version = '0.3.6.7'; // update this every time when edit the code!!!

// !!! WARNING this module must not have any library depdendency

////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////
/// network socket class simple implemtation
class Socket {
    constructor(ns, port) {
        this.ns = ns;
        this.port = port;
    }
    async read(options = {}) {
        if (!this.port) return [];
        const ns = this.ns;
        const timeout = options.timeout || 100;
        const start = Date.now();
        while (true) {
            const str = await ns.readPort(this.port);
            if (str !== "NULL PORT DATA") {
                const data = str.split("|");
                return data;
            }
            if (options.timeout && Date.now() - start >= options.timeout) break;
            await ns.sleep(timeout);
        }
        return [];
    }
    async write(...data) {
        if (!this.port) return;
        const ns = this.ns;
        return await ns.tryWritePort(this.port, data.join("|"));
    }

    async listen(callback, options = {}) {
        if (!this.port) return;
        const ns = this.ns;
        const timeout = options.timeout || 100;
        while(true) {
            const start = Date.now();
            while (true) {
                const str = ns.readPort(this.port);
                if (str !== "NULL PORT DATA") {
                    const data = str.split("|");
                    if (!await callback(time, data)) return;
                    if (options.idle && Date.now() - start > timeout) await options.idle();
                    continue;
                }
                break;
            }
            this.time = Date.now();
            if (options.idle) if (!await options.idle()) return;
            if (Date.now() - start > timeout) continue;
            await ns.sleep(timeout);
        }
    }
}

////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////
/// logger class implemtation
class Logger {
    constructor(ns, options = {}) {
        this.ns = ns;

        this.quiet   = 0; // 1 do not output log to console, 0 - output log to console
        this.console = 0; // 0 do not output log to log, 1 - output log to log
        this.debugLevel = options["debugLevel"] || 0;
        this.logLevel   = options["logLevel"]   || 0;

        if (options["args"]) {
            const args = options["args"];
            this.debugLevel = args["debug"] !== undefined ? args["debug"] : this.debugLevel;
            this.logLevel   = args["log"] !== undefined ? args["log"] :  this.logLevel;
            if (args["quiet"]) {
                this.quiet = 1;
            }
            if (args["verbose"]) {
                this.logLevel = args["log"] || 1;
                this.quiet = 0;
            }
            if (args["console"]) {
                this.console = args["console"] == true ? 0 : 1 || 1;
            }
        }
    }
    // debug
    /** @param {Number} level 0..N **/
    /** @param {String} format sprintf **/
    /** @param {...Any} args **/
    d(level, format, ...args) {
        if (typeof(level) !== "number") throw Error("BUG: wrong usage of Logger.log(level, format, ..args), wrong type of argument level, expected number");
        if (this.debugLevel == 0 || level > this.debugLevel) return;
        const text = this.ns.sprintf("DEBUG: %s", this.ns.vsprintf(format, args));
        if (this.console) this.ns.print(text);
        if (this.quiet) return;
        this.ns.tprintf("%s", text);
    }
    // log
    /** @param {Number} level 0..N **/
    /** @param {String} format sprintf **/
    /** @param {...Any} args **/
    g(level, format, ...args) {
        if (typeof(level) !== "number") throw Error("BUG: wrong usage of Logger.log(level, format, ..args), wrong type of argument level, expected number");
        if (this.logLevel == 0 || level > this.logLevel) return;
        //how about to log into log ?
        const text = this.ns.vsprintf(format, args);
        if (this.console) this.ns.print(text);
        if (this.quiet) return;
        this.ns.tprintf("%s", text);
        return;
    }
    // log result, always without level, and this may be toasted
    /** @param {String} format sprintf **/
    /** @param {...Any} args **/
    r(format, ...args) {
        const text = this.ns.vsprintf(format, args);
        if (this.console) this.ns.print(text);
        if (Constants.toastLogResult) {
            this.ns.toast(text, "info", Constants.toastInfoTimeout);
        }
        this.ns.tprintf("%s", text);
        return;
    }
    // log error, allways without level
    /** @param {String} format sprintf **/
    /** @param {...Any} args **/
    e(format, ...args) {
        const text = this.ns.sprintf("ERROR: %s", this.ns.vsprintf(format, args));
        if (this.console) this.ns.print(text);
        this.ns.tprintf("%s", text);
    }
    // log error, allways without level
    /** @param {String} format sprintf **/
    /** @param {...Any} args **/
    w(format, ...args) {
        const text = this.ns.sprintf("WARNING: %s", this.ns.vsprintf(format, args));
        if (this.console) this.ns.print(text);
        this.ns.tprintf("%s", text);
    }
}



////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////
/// version
async function version(ns, port) {
    if (port !== undefined && port) {
        const data = ns.sprintf("%d|%s|%s", Date.now(), Module, Version);
        return ns.tryWritePort(port, data);
    }
    ns.tprintf("module %s version %s", Module, Version);
    return;
}

////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////
/// help
function help(ns) {
    ns.tprintf("usage: %s  ...args | --version [--update-port] | --help", Module);
    ns.tprintf("gather security rate into %s", securityFile);
    return;
}

////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////
/// matrix effect, not yet ready, draft
function matrix() {
    /*
        we have field of 30 columns on 62 rows
        calculate
        global speed 0.05  , line speed 0.05 > 0.1 for example random
        columns speed, length, pos 0 -> position of head, we can move chars %2 left, right, fill randorm char
        every iteration decide which columns is start show, empty of course
        line is showing attribute thats all
        output rows.map(row => row.join('')).join("\n");

    */
    return;
}

////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////
///
/// main
///
export async function main(ns) {
    const args = ns.flags([
        [ 'version'     , false ],
        [ 'update-port' , 0     ],
        [ 'help'        , false ],
        [ 'log'         , 1     ], // log level - 0 quiet, 1 and more verbose
        [ 'debug'       , 0     ], // debug level
        [ 'verbose'     , true  ], // verbose mode, short analog of --log-level 1
        [ 'quiet'       , false ]  // quiet mode, short analog of --log-level 0
    ]);

    if (args['version']) {
        return version(ns, args['update-port']);
    }
    if (args['help']) {
        return help(ns);
    }

    const [host, setupPort] = args["_"];
    const l = new Logger(ns, {...args, console: true});

    if (host == undefined) {
        return l.e("host is undefined");
    }
    if (setupPort == undefined) {
        return l.e("setup port is undefined");
    }

    const tail_height     = 30;
    const tail_width      = 62;
    const message_timeout = 1500;

    const socket = new Socket(ns, setupPort);

    ns.disableLog("ALL");
    ns.clearLog();
    ns.tail();

    ////////////////////////////////////////////////////////////////////////////////////////////////////////////////////
    /// just wait while caller free memory :)
    ns.print("knock, knock ...", "\n".repeat(tail_height-1));
    await ns.sleep(message_timeout);
    let update_data = socket.read(message_timeout);
    if (!update_data.length) {
        ns.clearLog();
        ns.print("matrix is brocken", "\n".repeat(tail_height-1));
        return;
    }

    ////////////////////////////////////////////////////////////////////////////////////////////////////////////////////
    // run setup scripts
    ns.clearLog();
    ns.print("wake up bithacker ...", "\n".repeat(tail_height-1));

    l.g(1, "setup system on host %s", host);
    l.g(1, "\tgather servers data");
    const pid_1 = await ns.exec("/h3ml/sbin/gather-servers-data.js", host, 1, host);
    if (!pid_1) {
        l.e("failed run %s", "/h3ml/sbin/gather-servers-data.js");
    }
    await ns.sleep(200);
    l.g(1, "\tgather security data");
    const pid_2 = await ns.exec("/h3ml/sbin/gather-security-data.js", host, 1, host);
    if (!pid_1) {
        l.e("failed run %s", "/h3ml/sbin/gather-security-data.js");
    }
    await ns.sleep(message_timeout);

    ////////////////////////////////////////////////////////////////////////////////////////////////////////////////////
    /// just message without meaning
    ns.clearLog();
    ns.print("follow the rabbit ...", "\n".repeat(tail_height-1));
    await ns.sleep(message_timeout);

    ////////////////////////////////////////////////////////////////////////////////////////////////////////////////////
    /// test progress bar
    const timeout = 10000;
    const gap_timeout = 50;
    const n = timeout/gap_timeout;
    const progress_bar_length = 30;
    let i = 0;
    while (i++ < n) {
        const percent = (100/n)*i;
        const text = ns.sprintf("setup [%s%s] %.2f%%%s",
            percent == 0 ?   "" : "█".repeat(Math.floor((percent/100)*progress_bar_length)),
            percent == 100 ? "" : "▒".repeat(Math.floor(progress_bar_length-(percent/100)*progress_bar_length)),
            percent, "\n".repeat(tail_height-1)
        );
        ns.clearLog();
        ns.print(text);
        await ns.sleep(gap_timeout);
    }

    await ns.sleep(message_timeout);

    ////////////////////////////////////////////////////////////////////////////////////////////////////////////////////
    /// done

    l.g(1, "setup done");
}

////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////
////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////

