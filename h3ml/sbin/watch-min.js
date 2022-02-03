const Module  = '/h3ml/sbin/watch-min.js';
const Version = '0.3.4.16'; // update this every time when edit the code!!!

import {Constants}      from "/h3ml/lib/constants.js";
import {Logger}         from "/h3ml/lib/log.js"
import {Socket}         from "/h3ml/lib/network.js";
import {Units}          from "/h3ml/lib/units.js";
import {serversData}    from "/h3ml/etc/servers.js";
import {updateInfo}     from "/h3ml/lib/server-info-min.js";
import {Target}         from "/h3ml/lib/target-min.js"
import {BotNet}         from "/h3ml/lib/botnet-min.js"

async function version(ns, port) {
    if (port !== undefined && port) {
        const data = ns.sprintf("%d|%s|%s", Date.now(), Module, Version);
        return ns.tryWritePort(port, data);
    }
    ns.tprintf("version %s", Version);
    return;
}

function help(ns) {
    ns.tprintf("usage: %s  ...args | --version [--update-port] | --help", Module);
    ns.tprintf("its is a worker for h3ml to do action on target host: hack, grow, weakern '%s'");
    ns.tprintf("this module using target library to spread work across targets");
    return;
}

/*
    minimal watcher implementation without ctrl hack server list

*/

let quietMode    = 1;

class WatchTarget {
    constructor(ns, name) {
        this.ns             = ns;
        this.name           = name;
        this.currentAction  = "";
        this.currentThreads = 0;
        this.currentValue   = 0;
        this.totalAmount    = 0;
        this.actionTime     = Date.now();
        this.hosts          = new Map();
        this.lastAction     = "";
        this.diffAvailMoney = Units.money(0);
        this.timeSpent      = Units.time(0);
        this.totalAmount    = 0;
        this.diffSecuriry   = 0;
        this.startTime      = 0;
        this.endTime        = 0;
        this.hosts          = new Map();
        this.info();
    }
    method(method, start, end) {
        this.currentAction  = method;
        this.currentThreads = 0;
        this.currentValue   = 0;
        this.actionTime     = start;
        this.startTime      = start;
        this.endTime        = end;
        this.hosts          = new Map();
        this.info();
    }
    info() {
        const ns = this.ns;
        const server = serversData[this.name];
        this.currentSecurity = ns.getServerSecurityLevel(this.name);
        this.minSecurity     = server.minSecurity;
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
        Object.keys(serversData)
            .forEach(name => {
                const server = serversData[name];
                if (server.maxMoney > 0) {
                    this.targets_.set(name, new WatchTarget(this.ns, name));
                }
            });
    }

    get targets() {return this.targets_;}
    async idle() {}
    async router() {}
    async start() {}
    async stop() {}
    async ctrl() {}
    async info() {};
}

const Watcher = new _Watcher;

////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////
// actionStart
async function actionStart(watcher, time, data) {
    const l = watcher.lg;
    const ns = l.ns;
    const [host, start, threads, server, method, end] = data;

    if (!Watcher.targets.has(server)) {
        Watcher.targets.set(server, new WatchTarget(ns, server));
    }

    if (Watcher.targets.has(server)) {
        const target = Watcher.targets["get"](server);
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

    const [host, eventTime, threads, server, method, result] = data;
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
                            currentTarget.availMoney > target.availMoney
                                ? "+"
                                : currentTarget.availMoney == target.availMoney
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
                    const text = ns.sprintf("%s +%.2f%s", server, currentTarget.diffAvailMoney.amount, currentTarget.diffAvailMoney.unit);
                    let timeout = Math.log10(currentTarget.diffAvailMoney/1000000)*5;
                    if (timeout < 5) timeout = 5;
                    if (timeout > 60) timeout = 60;
                    ns.toast(text, "success", timeout * 1000);
                }
                //replace target
                Watcher.targets.set(server, currentTarget);

                //ns.run("server-analyze.js", 1, server);

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

    if (quietMode == 0) l.g(1, "ctrl receive %s, port %d", data[1], data[0]);

    switch (data[1]) {
        case "quiet":
            quietMode = 1;
            break;
        case "verbose":
            quietMode = 0;
            break;
        default:
            socket.write("#|Error|unknown command");
    }
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
// main

/** @param {NS} ns **/
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

    ns.disableLog("ALL");

    const l = new Logger(ns, {args: args});

    Watcher.init(l);


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
                        await actionCtrl(Watcher, time, data);
                        break;
                    case '#':
                        //info to output
                        await actionInfo(Watcher, time, data);
                }
            },
            {
                timeout: 1000,
                //idle: Watcher.idle
                idle: async () => {
                    //check events;
                    l.d(1, "idle, do checks");
                }
            }
        );
    }
}
