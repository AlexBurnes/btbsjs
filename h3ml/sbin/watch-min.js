const Module  = '/h3ml/sbin/watch-min.js';
const Version = '0.3.6.30'; // update this every time when edit the code!!!

import {Constants}      from "/h3ml/lib/constants.js";
import {Logger}         from "/h3ml/lib/log.js"
import {Socket}         from "/h3ml/lib/network.js";
import {Units}          from "/h3ml/lib/units.js";
import {BotNet}         from "/h3ml/lib/botnet-min.js";
import {Servers}        from "/h3ml/lib/server-list.js";
import {Server}         from "/h3ml/lib/server-min.js";
import {HackInfo}       from "/h3ml/lib/hack-server-min.js";
import {serversData}    from "/h3ml/etc/servers.js";
import {scriptFiles}    from "/h3ml/var/files.js";

async function version(ns, port) {
    if (port !== undefined && port) {
        const data = ns.sprintf("%d|%s|%s", Date.now(), Module, Version);
        return ns.tryWritePort(port, data);
    }
    ns.tprintf("module %s version %s", Module, Version);
    return;
}

function help(ns) {
    ns.tprintf("usage: %s | --version [--update-port] | --help", Module);
    ns.tprintf("listen port for events from workers, collect data on target actions");
    return;
}

/*
    minimal watcher implementation without ctrl hack server list

*/

let quietMode    = 1;
const watchDataFile = "/h3ml/var/watcher.txt"; //FIXME move to constants

class WatchTarget {
    constructor(ns, name) {
        this.ns             = ns;
        this.name           = name;
        this.state          = 0;    //state of target 0 do not do any actions, 1 hacking
        this.currentAction  = "";
        this.currentThreads = 0;
        this.currentValue   = 0;
        this.totalAmount    = 0;
        this.surgeTimeout = Date.now();
        this.surgeAmount  = 0;
        this.actionTime     = Date.now();
        this.lastAction     = "";
        this.diffAvailMoney = Units.money(0);
        this.timeSpent      = Units.time(0);
        this.diffSecuriry   = 0;
        this.startTime      = 0;
        this.endTime        = 0;
        this.hosts          = new Map();
        this.batches        = new Map();
        this.info();
    }
    method(method, start, end) {
        this.currentAction  = method;
        this.currentThreads = 0;
        this.currentValue   = 0;
        this.actionTime     = start;
        this.startTime      = start;
        this.endTime        = end;
        this.info();
    }
    info() {
        const ns = this.ns;
        const server = serversData[this.name];
        this.currentSecurity = ns.getServerSecurityLevel(this.name);
        this.minSecurity     = server.minSecurity || 0;
        this.availMoney      = Units.money(ns.getServerMoneyAvailable(this.name));
        this.maxMoney        = Units.money(server.maxMoney);
    }
}

class _Watcher {
    constructor() {
        if (!_Watcher._instance) {
            _Watcher._instance = this
        }
        return _Watcher._instansce;
    }

    init(l) {
        this.lg = l;
        this.ns = l.ns;
        this.socket = new Socket(this.ns, Constants.watchPort);
        this.targets_ = new Map();
        this.hackInfo = new HackInfo(l);
        this.maxNameLength = 0;
        Object.keys(serversData)
            .forEach(name => {
                const server = serversData[name];
                if (server.maxMoney > 0) {
                    this.maxNameLength = Math.max(name.length, this.maxNameLength);
                    this.targets_.set(name, new WatchTarget(this.ns, name));
                }
            });
        l.d(1, "max length name %d", this.maxNameLength);
        const watchData = this.ns.read(watchDataFile);
        if (watchData) {
            //FIXME use json parse and stringify for this
            l.g(1, "there is a watch data, use it for init watcher");
            const rows = watchData.split(";\n");
            rows.forEach(row => {
                const data = row.split("|");
                l.d(1, "%s %s", data[0], data.join());
                if (this.targets_.has(data[0])) {
                    const target = this.targets_["get"](data[0]);
                    target.currentState    = data[1] || 0;
                    target.currentAction   = data[2] || "";
                    target.currentThreads  = data[3];
                    target.currentValue    = data[4];
                    target.totalAmount     = Number(data[5]);
                    target.actionTime      = data[6];
                    target.lastAction      = data[7] || "";
                    target.diffAvailMoney  = Units.money(data[8]);
                    target.timeSpent       = Units.time(data[9]);
                    target.diffSecuriry    = data[10];
                    target.startTime       = data[11];
                    target.endTime         = data[12];
                    const hosts = data[13].split(",").filter(name => !name.match(/^$/));
                    hosts.forEach(name => target.hosts.set(name, true));
                    target.info();
                }
            });
        }
    }

    get targets() {return this.targets_;}
    async idle() {}
    async router() {}
    async start() {}
    async stop() {}
    async ctrl() {}
    async info() {};
    save() {
        this.lg.g(1, "save watch data");
        //FIXME use json
        let watchData = "";
        this.targets
            .forEach((target, name) => {
                watchData += [
                          name
                        , target.currentState
                        , target.currentAction
                        , target.currentThreads
                        , target.currentValue
                        , target.totalAmount
                        , target.actionTime
                        , target.lastAction
                        , target.diffAvailMoney.value
                        , target.timeSpent.value
                        , target.diffSecuriry
                        , target.startTime
                        , target.endTime
                    ].join('|');
                watchData += "|";
                target.hosts.forEach((_, name) => {watchData += name + ","});
                watchData += ";\n";
            });
        this.ns.write(watchDataFile, watchData, "w");
    }
}

const Watcher = new _Watcher;

////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////
// actionStart
async function actionStart(watcher, time, data) {
    const l = watcher.lg;
    const ns = l.ns;
    const [host, start, threads, server, method, end, batch] = data;

    if (!Watcher.targets.has(server)) {
        Watcher.targets.set(server, new WatchTarget(ns, server));
    }

    if (Watcher.targets.has(server)) {
        const target = Watcher.targets["get"](server);

        if (batch !== undefined) {
            target.method(method, start, end);
            return;
        }

        if (target.actionTime <= start) {
            if (target.actionTime < start) {
                target.method(method, start, end);
            }
            target.currentThreads += threads;
            target.hosts.set(host, true);
            const estimate = new Date(Date.now + end).toUTCString().substr(17, 8);
            l.d(1, "start on host '%s' target '%s' action '%s' threads %d start time %d, %s, wait hosts %d",
                host, server, method, threads, time, estimate, target.hosts.size
            );
        }
    }
}

////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////
// actionStart
async function actionStop(watcher, time, data) {
    const l = watcher.lg;
    const ns = l.ns;

    const [host, eventTime, threads, server, method, result, batch] = data;

    let resultStr = "";
    switch (method) {
        case "weaken":
            resultStr = ns.sprintf("%.2f", result);
            break;
        case "grow":
            resultStr = ns.sprintf("%.2f", result);
            break;
        case "hack":
            const amount = Units.money(result);
            resultStr = ns.sprintf("%.2f%s", amount.amount, amount.unit);
            break;
    }

    l.d(1, "stop on host '%s' target '%s' action '%s' threads %d result %s start time %d",
        host, server, method, threads, resultStr, eventTime
    );

    if (!Watcher.targets.has(server)) {
        Watcher.targets.set(server, new WatchTarget(ns, server));
    }

    if (Watcher.targets.has(server)) {
        const target = Watcher.targets["get"](server);

        if (batch !== undefined) {
            if (method == "hack") {
                target.totalAmount += Number(result);
                target.surgeAmount += Number(result);
                if (Date.now() - target.surgeTimeout > 60*1000 ) { // 1 minute
                    target.surgeTimeout = Date.now();
                    const money = Units.money(target.surgeAmount).pretty(ns);
                    target.surgeAmount = 0;
                    const text = ns.sprintf("%s%s+%s",
                        // !!! " " is a utf8 FIGURE SPACE !!
                        server, " ".repeat(Watcher.maxNameLength-server.length + 8 - money.length), money,
                    );
                    let timeout = Math.log10(result/1000000)*5;
                    if (timeout < 5) timeout = 5;
                    if (timeout > 60) timeout = 60;
                    ns.toast(text, "success", timeout * 1000);
                }
            };
            return;
        }


        l.d(1, "%s event time %d target action %s time %d host %s, wait hosts %d",
            server, time, target.currentAction, target.actionTime, host, target.hosts.size);

        if (target.currentAction !== "" && target.startTime == eventTime) { // ignore event if action time is older
            if (target.hosts.has(host)) {
                target.hosts.delete(host);
            }
            if (target.hosts.size == 0) {
                const currentTarget = new WatchTarget(ns, server);
                currentTarget.currentValue   = result;
                currentTarget.lastAction     = target.currentAction;
                currentTarget.diffAvailMoney = Units.money(Math.abs(currentTarget.availMoney.value - target.availMoney.value));
                currentTarget.diffSecuriry   = currentTarget.currentSecurity - target.currentSecurity;
                currentTarget.totalAmount    = target.totalAmount + (target.currentAction == "hack" ? currentTarget.diffAvailMoney.value : 0);
                currentTarget.timeSpent      = Units.time((Date.now() - target.startTime)/1000);

                const timeSpent = currentTarget.timeSpent;
                if (quietMode == 0) {
                    if (method == "weaken") {
                        l.g(1, "<= '%s' %s => %s%.2f -> %.2f / %.2f in %.2f%s",
                            server, method,
                            currentTarget.currentSecurity > target.currentSecurity
                                ? "+"
                                : "",
                            currentTarget.diffSecuriry,
                            currentTarget.currentSecurity, currentTarget.minSecurity,
                            timeSpent.time, timeSpent.unit
                        );
                    }
                    else {
                        l.g(1, "<= '%s' %s => %s%.2f%s -> %.2f%s / %.2f%s in %.2f%s",
                            server, method,
                            currentTarget.availMoney.value > target.availMoney.value
                                ? "+"
                                : currentTarget.availMoney.value == target.availMoney.value
                                    ? ""
                                    : "-",
                            currentTarget.diffAvailMoney.amount, currentTarget.diffAvailMoney.unit,
                            currentTarget.availMoney.amount, currentTarget.diffAvailMoney.unit,
                            currentTarget.maxMoney.amount,   currentTarget.maxMoney.unit,
                            timeSpent.time, timeSpent.unit
                       );
                    }
                }
                //FIXME need caclulate timeout depends on money value
                if (method == "hack" && currentTarget.diffAvailMoney.value > 0) {
                    const money = currentTarget.diffAvailMoney.pretty(ns);
                    const text = ns.sprintf("%s%s+%s",
                        // !!! " " is a utf8 FIGURE SPACE !!!
                        server, " ".repeat(Watcher.maxNameLength-server.length + 8 - money.length), money
                    );
                    let timeout = Math.log10(currentTarget.diffAvailMoney.value/1000000)*5;
                    if (timeout < 5) timeout = 5;
                    if (timeout > 60) timeout = 60;
                    ns.toast(text, "success", timeout * 1000);
                }
                //replace target
                Watcher.targets.set(server, currentTarget);

                //FIXME here we can start hack the server
                if (target.currentAction == 1) {
                    doHackAction(l, Watcher, target);
                }

                //hackInfo(l, Watcher);

            }
        }
    }

}

////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////
// ctrl
async function actionCtrl(watcher, time, data) {
    const l = watcher.lg;
    const ns = l.ns;

    const socket = new Socket(ns, data[0]);

    l.g(1, "ctrl receive %s, port %d", data[1], data[0]);

    switch (data[1]) {
        case "server-hacking-list":
            serversHackList(l, watcher, socket);
            break;
        case "quiet":
            quietMode = 1;
            break;
        case "verbose":
            quietMode = 0;
            break;
        case "start-hack":
            startHackServer(l, watcher, socket, data[2]);
            break;
        case "stop-hack":
            stopHackServer(l, watcher, socket, data[2]);
            break;
        case "stop":
            watcher.save();
            return 0;

        default:
            socket.write("#|Error|unknown command");
    }
    return 1;
}

////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////
// startHackServer
async function startHackServer(l, watcher, socket, name) {
    if (watcher.targets.has(name)) {
        const target = watcher.targets["get"](name);
        if (target.currentState == 1) {
            return socket.write("#", "Error", "start-hack", "already hacking", name);
        }
        target.currentState = 1;
        doHackServer(l, watcher, target);
    }
    else {
        //new target, check that server is exists
        const target = new WatchTarget(l.ns, name);
        watcher.targets.set(name, target);
        target.currentState = 1;
        doHackServer(l, watcher, target);
    }
    await socket.write("#", "OK", "start-hack", "start hacking", name);
}

async function doHackServer(l, watcher, target) {
    // do hack action
    l.g(1, "do hack action on target %s", target.name);
    //FIXME
}

////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////
// stopHackServer
async function stopHackServer(l, watcher, socket, name) {
    if (watcher.targets.has(name)) {
        const target = watcher.targets["get"](name);
        if (target.currentState == 0) {
            return socket.write("#", "Error", "stop-hack", "do not haking", name);
        }
        target.currentState = 0;
    }
    else {
        return socket.write("#", "Error", "stop-hack", "do not haking", name);
    }
    await socket.write("#", "OK", "stop-hack", "stop haking", name);
}


////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////
// list of hacking servers
async function serversHackList(l, watcher, socket) {
    const ns = l.ns;
    l.d(1, "prepare list");
    const scripts = new Map();
    Servers.list(ns).forEach(server => {
        //l.g(1, "server %s", server.name);
        const procs = ns.ps(server.name);
        //ns.tprint(procs);
        procs
            .filter(proc => proc.filename.match(/server-hack(\-[^\.]+?)?\.js$/))
            .forEach(proc => {
                proc.args
                    .filter(arg => !arg.match(/^--/))
                    .forEach(arg => {scripts.set(arg, true); l.d(1, "set %s hack %s", server.name, arg);})
            });
    });
    const list = new Array();
    watcher.targets.forEach((server, key) => {
        l.d(1, "server %s, action %s", server.name, server.currentAction);
        if (scripts.has(server.name)) list.push(server);
    });

    const info = list.map(
        s =>
            ns.sprintf("%s,%s,%d,%d,%s,%f,%f,%f",
                s.name, s.currentAction, s.startTime, s.endTime,
                s.lastAction, s.diffAvailMoney.value, s.totalAmount, s.diffSecuriry
            )
        ).join(";");
    l.d(1, "write info %s", info);
    await socket.write("#", "server-hacking-list", info);
}


////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////
// info from scripts, to output into terminal or log

async function actionInfo(watcher, time, data) {
    const l = watcher.lg;
    const ns = l.ns;

    if (quietMode == 0) l.g(1, "%s", data.join(", "));
    return;
}

////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////
// show hack stat on servers

function hackInfo(l, watcher) {
    const ns = l.ns;

    const scripts = new Map();
    Servers.list(ns).forEach(server => {
        //l.g(1, "server %s", server.name);
        const procs = ns.ps(server.name);
        //ns.tprint(procs);
        procs
            .filter(proc => proc.filename.match(/server-hack((\-[^\.]+?))?\.js$/))
            .forEach(proc => {
                //ns.tprint(`${proc.args}`);
                proc.args
                    //.filter(arg => !arg.match(/^--/))
                    .forEach(arg => {scripts.set(arg, true); l.d(1, "set %s hack %s", server.name, arg);})
            });
        });

    const hacking_servers = new Map();
    scripts.forEach( (_, name) => {
        if (watcher.targets.has(name)) {
            const target = watcher.targets["get"](name);
            const timeout = target.startTime - Date.now() + parseInt(target.endTime);
            const estimate = Units.time(target.currentAction !== undefined && timeout > 0 ? timeout/1000 : 0);
            const diff_amount = target.diffAvailMoney;
            const total_amount = Units.money(target.totalAmount);
            const diff_security = target.diffSecuriry;
            hacking_servers.set(name, [
                target.name,
                target.currentAction,
                estimate,
                target.lastAction,
                diff_amount,
                diff_security,
                total_amount
            ]);
        }
    });

    const servers = Servers.list(ns, Server)
        .filter(server => server.name !== 'home') // not home
        .filter(server => ns.getServerMaxMoney(server.name)) // has money
        .filter(server => ns.hasRootAccess(server.name)) // with root access
        .filter(server => ns.getServerRequiredHackingLevel(server.name) <= ns.getHackingLevel()); // hackable


    const botnet = new BotNet(ns);
    const botnetData =
        ns.sprintf("botnet %d memory %s max threads %s, free %s, used memory %s usage %.2f%%",
            botnet.servers.length, Units.size(botnet.maxRam * Constants.uGb).pretty(ns),
            Units.money(botnet.maxWorkers).pretty(ns),
            Units.money(botnet.workers).pretty(ns),
            Units.size(botnet.usedRam * Constants.uGb).pretty(ns), 100 * botnet.usedRam / botnet.maxRam
        );

    const data = watcher.hackInfo.info(botnet, servers, hacking_servers);
    ns.clearLog();
    ns.print(botnetData);
    ns.print(data.join("\n"));
}

async function wormTarget(l, target) {
    const ns = l.ns;
    if (!ns.hasRootAccess(target)) {
        await tryCatchIgnore(() => ns.brutessh(target))
        await tryCatchIgnore(() => ns.relaysmtp(target))
        await tryCatchIgnore(() => ns.httpworm(target))
        await tryCatchIgnore(() => ns.ftpcrack(target))
        await tryCatchIgnore(() => ns.sqlinject(target))
        await tryCatchIgnore(() => ns.nuke(target))
        l.r("worm '%s'", target);
    }
}

async function scpTarget(l, target) {
    const ns = l.ns;
    await tryCatchIgnore(async () =>
        await ns.scp(
            scriptFiles.filter(f => f.match(/worker.js|constants.js|network.js|log.js|quiet.js|verbose.js|h3ml-settings.js/), source, target.name)
        )
    );
}

async function scpServer(l, server) {
    await tryCatchIgnore(async () => await ns.scp(scriptFiles, source, server.name));
}

////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////
// main

/** @param {NS} ns **/
export async function main(ns) {
    const args = ns.flags([
        [ 'version'     , false ],
        [ 'update-port' , 0     ],
        [ 'help'        , false ],
        [ 'log'         , 1     ], // log level - 0 quiet, 1 and more verbose
        [ 'debug'       , 0     ], // debug level
        [ 'verbose'     , false ], // verbose mode, short analog of --log-level 1
        [ 'quiet'       , true ]  // quiet mode, short analog of --log-level 0
    ]);

    if (args['version']) {
        return version(ns, args['update-port']);
    }
    if (args['help']) {
        return help(ns);
    }

    ns.disableLog("ALL");
    ns.tail(Module);

    const l = new Logger(ns, {args: args});

    Watcher.init(l);

    // check target state, it they 1 then do action on it
    Watcher.targets.forEach((target, name) => {
        if (target.currentAction == 1) {
            doHackAction(l, Watcher, target);
        }
    });

    hackInfo(l, Watcher);

    // drop all old events
    let oldTime = Date.now();
    l.d(1, "time %d", oldTime);

    while (true) {

        await Watcher.socket.listen(
            async (time, data) => {
                //await Watcher.router(time, data);
                switch (data.shift()) {
                    case '<':
                        // stop method
                        await actionStop(Watcher, time, data);
                        break;
                    case '>':
                        // start method
                        await actionStart(Watcher, time, data);
                        break;
                    case '@':
                        // request stat
                        if (!await actionCtrl(Watcher, time, data))
                            return 0;
                        break;
                    case '#':
                        //info to output
                        await actionInfo(Watcher, time, data);
                }
                return 1; //continue
            },
            {
                timeout: 1000,
                //idle: Watcher.idle
                idle: async () => {
                    //check events;
                    hackInfo(l, Watcher);
                    return 1;
                }
            }
        );
    }
}

/**
 * @param {(() => Promise<void>) | (() => void)} lambda
 * @returns {Promise<void>}
 */
async function tryCatchIgnore(lambda) {
    try {
        await lambda();
    } catch (e) {
        // ignore
    }
}
