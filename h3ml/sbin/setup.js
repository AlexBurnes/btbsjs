const Module  = '/h3ml/sbin/setup.js';
const Version = '0.3.6.25'; // update this every time when edit the code!!!

// !!! WARNING this module must not have any library depdendency

const tail_height     = 30;
const tail_width      = 62;
const wait_upload     = 60 * 1000;
const message_timeout = 1500;

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
        const wait = options.wait || 0; // wait infinit
        const start = Date.now();
        while (true) {
            const str = await ns.readPort(this.port);
            //ns.print(str);
            if (str !== "NULL PORT DATA") {
                const data = str.split("|");
                return data;
            }
            if (options.wait && Date.now() - start >= options.wait) break;
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

class ProgressBar {
    constructor(ns, total) {
        this.ns = ns;
        this.total = total;
        // FIXME make this parameters is defined
        this.length = 38;

    }
    progress(i) {
        const percent = (100/this.total)*i;
        const text = this.ns.sprintf("[%s%s] %d%%",
            percent == 0 ?   "" : "█".repeat(Math.floor((percent/100)*this.length)),
            percent == 100 ? "" : "▒".repeat(Math.floor(this.length-(percent/100)*this.length)),
            percent
        );
        return text;
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

function draw(ns, ...data) {
    ns.clearLog();
    ns.print(data.join("\n"), "\n".repeat(tail_height - data.length));
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
        [ 'verbose'     , false ], // verbose mode, short analog of --log-level 1
        [ 'quiet'       , true  ]  // quiet mode, short analog of --log-level 0
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

    const socket = new Socket(ns, setupPort);

    ns.disableLog("ALL");
    ns.clearLog();
    ns.tail();

    let update_data = "";

    ////////////////////////////////////////////////////////////////////////////////////////////////////////////////////
    /// just wait while caller free memory :)
    draw(ns, "knock, knock ...");
    await ns.sleep(message_timeout);
    update_data = await socket.read({wait: message_timeout});
    if (!update_data.length || update_data[0] !== "initial-phase") return draw(ns, "matrix is brocken");

    ////////////////////////////////////////////////////////////////////////////////////////////////////////////////////
    // run setup scripts
    draw(ns, "wake up bithacker ...");
    await ns.sleep(message_timeout);

    ////////////////////////////////////////////////////////////////////////////////////////////////////////////////////
    // wait upload core files data
    update_data = await socket.read({wait: message_timeout});
    ns.print(update_data);
    if (!update_data.length || update_data[0] !== "pre-upload-phase") return draw(ns, "matrix is brocken");

    const core_total = Number(update_data[1]);
    const core_bar = new ProgressBar(ns, core_total);
    let i = 0;
    while (i < core_total) {
        update_data = await socket.read({wait: wait_upload});
        if (!update_data.length || update_data[0] !== "pre-uploading-phase") return draw(ns, "matrix is brocken");
        i = Number(update_data[1]) + 1;
        draw(ns, ns.sprintf("core %s", core_bar.progress(i)));
    }
    await ns.sleep(message_timeout);

    update_data = await socket.read({wait: message_timeout});
    if (!update_data.length || update_data[0] !== "pre-setup-phase") return draw(ns, "matrix is brocken");

    await ns.sleep(message_timeout);

    update_data = await socket.read({wait: message_timeout});
    if (!update_data.length || update_data[0] !== "run-updater-phase") return draw(ns, "matrix is brocken");

    ////////////////////////////////////////////////////////////////////////////////////////////////////////////////////
    // upload files
    update_data = await socket.read({wait: message_timeout});
    if (!update_data.length || update_data[0] !== "upload-updater-phase") return draw(ns, "matrix is brocken");

    const upload_total = update_data[1];
    const upload_bar = new ProgressBar(ns, upload_total);
    i = 0;
    while (i < upload_total) {
        update_data = await socket.read({wait: wait_upload});
        if (!update_data.length || update_data[0] !== "uploading-updater-phase") return draw(ns, "matrix is brocken");
        i = Number(update_data[1]) + 1
        draw(ns, ns.sprintf("system %s", upload_bar.progress(i)));
    }
    await ns.sleep(message_timeout);

    update_data = await socket.read({wait: message_timeout});
    if (!update_data.length || update_data[0] !== "post-setup-phase") return draw(ns, "matrix is brocken");
    await ns.sleep(message_timeout);

    ////////////////////////////////////////////////////////////////////////////////////////////////////////////////////
    /// run setup after update
    draw(ns, "follow the rabbit ...");

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
    /// done
    draw(ns, read("/h3ml/var/images/bitburner.txt"));
    l.g(1, "setup done");

    while (true) {
        // do something
        await ns.sleep(100);
    }
}

////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////
////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////

