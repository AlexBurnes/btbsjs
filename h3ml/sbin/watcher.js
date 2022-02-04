const Module  = '/h3ml/sbin/watcher.js';
const Version = '0.3.4.18'; // update this every time when edit the code!!!

import {Constants}      from "/h3ml/lib/constants.js";
import {Logger}         from "/h3ml/lib/log.js"
import {Socket}         from "/h3ml/lib/network.js";
import {moneyFormat ,timeFormat}    from "/h3ml/lib/units.js"
import {Servers}        from "/h3ml/lib/server-list.js"

async function version(ns, port) {
    if (port !== undefined && port) {
        const data = ns.sprintf("%d|%s|%s", Date.now(), Module, Version);
        return ns.tryWritePort(port, data);
    }
    ns.tprintf("module %s version %s", Module, Version);
    return;
}

function help(ns) {
    ns.tprintf("usage: %s  ...args | --version [--update-port] | --help", Module);
    ns.tprintf("its is a worker for h3ml to do action on target host: hack, grow, weakern '%s'");
    ns.tprintf("this module is used by target library to spread work across targets");
    return;
}

/*
    listen port and output events info
    watch for hack,grow,weaken actions and output server affected information

*/

const protocolVersion = Constants.protocolVersion;
const watchPort       = Constants.watchPort;

const debugLevel = 0;
const logLevel   = 1;

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
        this.diffAvailMoney = moneyFormat(0);
        this.timeSpent      = timeFormat(0);
        this.totalAmount    = 0;
        this.diffSecuriry   = 0;
        this.startTime      = 0;
        this.endTime        = 0;
        this.hosts          = new Map();
        info();
    }
    method(method, start, end) {
        this.currentAction  = method;
        this.currentThreads = 0;
        this.currentValue   = 0;
        this.actionTime     = start;
        this.startTime      = start;
        this.endTime        = end;
        this.hosts          = new Map();
        info();
    }
    info() {
        const ns = this.ns;
        this.currentSecurity = ns.getServerSecurityLevel(this.name);
        this.minSecurity     = ns.getServerMinSecurityLevel(this.name);
        this.availMoney      = moneyFormat(ns.getServerMoneyAvailable(this.name));
        this.maxMoney        = moneyFormat(ns.getServerMaxMoney(this.name));
    }
}

////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////
// actionStart
async function actionStart(l, servers, time, data) {
    const ns = l.ns;
    const [host, start, threads, server, method, end] = data;

    if (!servers.has(server)) {
        servers.set(server, new WatchTarget(ns, server));
    }

    if (servers.has(server)) {
        const target = servers["get"](server);
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
async function actionStop(l, servers, time, data) {
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
            const amount = moneyFormat(result);
            resultStr = ns.sprintf("%.2f%s", amount.amount, amount.unit);
            break;
    }

    l.d(1, "stop on host '%s' target '%s' action '%s' threads %d result %s start time %d",
        host, server, method, threads, resultStr, eventTime
    );

    if (!servers.has(server)) {
        servers.set(server, new WatchTarget(ns, server));
    }

    if (servers.has(server)) {
        const target = servers["get"](server);

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
                currentTarget.diffAvailMoney = moneyFormat(Math.abs(currentTarget.availMoney.value - target.availMoney.value));
                currentTarget.diffSecuriry   = currentTarget.currentSecurity - target.currentSecurity;
                currentTarget.totalAmount    = target.totalAmount + (target.currentAction == "hack" ? currentTarget.diffAvailMoney.value : 0);
                currentTarget.timeSpent      = timeFormat((Date.now() - target.startTime)/1000);

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
                    const text = ns.sprintf("%s +%.2f%s", server, currentTarget.diffAvailMoney.amount, currentTarget.diffAvailMoney.unit);
                    let timeout = Math.log10(currentTarget.diffAvailMoney.value/1000000)*5;
                    if (timeout < 5) timeout = 5;
                    if (timeout > 60) timeout = 60;
                    ns.toast(text, "success", timeout * 1000);
                }
                //replace target
                servers.set(server, currentTarget);

                //ns.run("server-analyze.js", 1, server);

            }
        }
    }

}

////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////
// list of hacking servers
async function serversHackList(l, socket) {
    const ns = l.ns;
    const scripts = new Map();
    Servers.list().forEach(server => {
        const procs = ns.ps(server.name);
        procs
            .filter(proc => proc.filename == "server-hack.js")
            .forEach(proc => {
                proc.args
                    .filter(arg => !arg.match(/^--/))
                    .forEach(arg => {scripts.set(arg, true)})
            });
    });
    const list = new Array();
    Watcher.targets.forEach((server, key) => {
        l.d(1, "server %s, action %s", server.name, server.currentAction);
        if (
            ns.getServerMaxMoney(server.name) > 0 &&
            ns.hasRootAccess(server.name) &&
            ns.getServerRequiredHackingLevel(server.name) <= ns.getHackingLevel() &&
            scripts.has(server.name)
        ) {
            list.push(server);
        }
    });

    if (port > 0)  {
        const info =
            list
                .map(
                    s =>
                        ns.sprintf("%s,%s,%d,%d,%s,%f,%f,%f",
                            s.name, s.currentAction, s.startTime, s.endTime,
                            s.lastAction, s.diffAvailMoney.value, s.totalAmount, s.diffSecuriry
                        )
                )
                .join(";");
        await socket.write(info);
    }
}


////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////
// ctrl
async function actionCtrl(l, servers, time, data) {
    const ns = l.ns;

    const port = data[0];

    if (quietMode == 0) l.g(1, "ctrl receive %s, port %d", data[1], data[0]);

    switch (data[1]) {
        case "server-hacking-list":
            serversHackList(l, socket);
            break;
        case "quiet":
            quietMode = 1;
            break;
        case "verbose":
            quietMode = 0;
            break;
        default:
            if (port > 0) {
                await ns.tryWritePort(port, ns.sprintf("%d|%d|#|Error|", Date.now(), protocolVersion, "error", "unknown command"));
            }
    }
}

////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////
// info from scripts, to output into terminal or log

async function actionInfo(l, servers, time, data) {
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

    // run only at home and ctr-server
    if (!ns.getHostname().match(/home|ctrl-server/)) {
        ns.tprintf("could be run only on home or ctrl-server");
        return;
    }
    //check that we do not run on home or ctrl-server
    const is_home_run =
        ns.getHostname() != "home" &&
        ns.ps("home").filter(proc => proc.filename == Module).length
        ? true
        : false;

    const is_ctrl_run =
        ns.getHostname() != "ctrl-server" &&
        ns.serverExists("ctrl-server") &&
        ns.ps("ctrl-server").filter(proc => proc.filename == Module).length
        ? true
        : false;

    if (is_home_run || is_ctrl_run){
        ns.tprintf("module is already running on %s", is_home_run ? "home" : "ctrl-server");
        return;
    }

    if (ns.getHostname() !== "ctrl-server" && ns.serverExists("ctrl-server")) {
        l.g(1, "start watcher on 'ctrl-server'");
        ns.exec(Module, "ctrl-server", 1);
        return;
    }

    const servers = new Map();
    Servers.list(ns)
        .forEach(server => {
            servers.set(server.name, new WatchTarget(ns, name));
        });

    // drop all old events
    let oldTime = Date.now();
    l.d(1, "time %d", oldTime);

    while (true) {
        const str = await ns.readPort(watchPort);
        if (str !== "NULL PORT DATA") {
            l.d(1, "time %d", oldTime);
            const [time, version, action, ...data] = str.split("|");
            if (time == undefined || version == undefined || version != protocolVersion) continue; //failed
            l.d(1, "%d %s: %s", time, action, data.join(", "));
            if (time < oldTime) continue; // do not read old events from port
            switch (action) {
                case '<':
                    // stop method
                    await actionStop(l, servers, time, data);
                    break;
                case '>':
                    // start method
                    await actionStart(l, servers, time, data);
                    break;
                case '@':
                    // request stat
                    await actionCtrl(l, servers, time, data);
                    break;
                case '#':
                    //info to output
                    await actionInfo(l, servers, time, data);
            }
            continue;
        }
        oldTime = Date.now();

        //FIXME need function to check wait sto events from servers;
        // need event driven mechanism, like listent + on receive
        await ns.sleep(100);
    }
}
