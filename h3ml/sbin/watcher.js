const Module  = '/h3ml/sbin/watcher.js';
const Version = '0.3.2.28'; // update this every time when edit the code!!!

import {Constants}      from "/h3ml/lib/constants.js";
import {Logger}         from "/h3ml/lib/log.js"
import {Socket}         from "/h3ml/lib/network.js";
import {moneyFormat, timeFormat}
                        from "/h3ml/lib/units.js"
import {Servers}        from "/h3ml/lib/server-list.js"
import {updateInfo}     from "/h3ml/lib/server-info.js"

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

let quietMode    = 0;

async function actionStart(l, servers, time, data) {
    const ns = l.ns;
    const [host, start, threads, server, method, end] = data;

    if (servers["get"](server)) {
        const target = servers["get"](server);
        if (target.actionTime <= start) {
            if (target.actionTime < start) {     // new action group events
                target.currentAction  = method;
                target.currentThreads = threads;
                target.currentValue   = 0;
                target.actionTime     = start;
                target.startTime      = start;
                target.endTime        = end;
                updateInfo(ns, target);
                target.hosts = new Map();
            }
            const hostServer = new Server(host);
            target.hosts.set(host, hostServer);
            hostServer.currentAction  = method;
            hostServer.currentThreads += threads;
            hostServer.currentValue   = 0;
            hostServer.startTime      = start;
            hostServer.endTime        = end;
        }
        const estimate = new Date(Date.now + end).toUTCString().substr(17, 8);
        l.d(1, "start on host '%s' target '%s' action '%s' threads %d start time %d, %s, wait hosts %d",
            host, server, method, threads, time, estimate, target.hosts.size
        );
    }
}

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

    if (servers["get"](server)) {
        const target = servers["get"](server);
        const currentTarget = new Server(server);

        l.d(1, "%s event time %d target action %s time %d host %s, wait hosts %d",
            server, time, target.currentAction, target.actionTime, host, target.hosts.size);

        if (target.currentAction !== "" && target.startTime == eventTime) { // ignore event if action time is older
            if (target.hosts.has(host)) {
                target.hosts.delete(host);
            }
            if (target.hosts.size == 0) {
                updateInfo(ns, currentTarget);
                currentTarget.currentAction = "";
                currentTarget.startTime      = 0;
                currentTarget.endTime        = 0;
                currentTarget.currentThreads = 0;
                currentTarget.currentValue = result;
                currentTarget.actionTime = Date.now();
                currentTarget.lastAction = target.currentAction;
                currentTarget.diffAvailMoney = moneyFormat(Math.abs(currentTarget.availMoney.value - target.availMoney.value));
                currentTarget.totalAmount = target.totalAmount + (target.currentAction == "hack" ? currentTarget.diffAvailMoney.value : 0);
                currentTarget.diffSecuriry   = currentTarget.currentSecurity - target.currentSecurity;
                currentTarget.diffHackChance = currentTarget.hackChances/target.hackChances;
                currentTarget.diffHackTime   = currentTarget.hackTime.value/target.hackTime.value;
                currentTarget.diffGrowTime   = currentTarget.growTime.value/target.growTime.value;
                currentTarget.diffWeakTime   = currentTarget.weakTime.value/target.weakTime.value;
                // FIXME gather information for max/min times!!!
                const timeSpent = timeFormat((Date.now() - target.startTime)/1000);
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

async function actionCtrl(l, servers, time, data) {
    const ns = l.ns;

    const port = data[0];

    if (quietMode == 0) l.g(1, "ctrl receive %s, port %d", data[1], data[0]);

    switch (data[1]) {
        case "server-hacking-list":
            const scripts = new Map();
            const own_servers = ns.getPurchasedServers();
            own_servers.push("home");
            own_servers.forEach(server => {
                const procs = ns.ps(server);
                procs
                    .filter(proc => proc.filename == "server-hack.js")
                    .forEach(proc => {
                        scripts.set(proc.args[0], true)
                    });
            });
            const list = new Array();
            servers.forEach((server, key) => {
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
                await ns.tryWritePort(port, ns.sprintf("%d|%d|#|server-hacking-list|%s", Date.now(), protocolVersion, info));
            }
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
    /*const data = Object.keys(servers)
    .map(name => {
        const server = servers[name];
        return ns.sprintf("%s,%s,%s,%s", name, server.currentAction, server.currentThreads, server.currentValue);
    })
    .join(";");
    */
}

async function actionInfo(l, servers, time, data) {
    const ns = l.ns;

    if (quietMode == 0) l.g(1, "%s", data.join(", "));
    return;
}

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
        ? true : false;
    const is_ctrl_run =
        ns.getHostname() != "ctrl-server" &&
        ns.serverExists("ctrl-server") &&
        ns.ps("ctrl-server").filter(proc => proc.filename == Module).length
        ? true : false;

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
            server.currentAction  = "";
            server.currentThreads = 0;
            server.currentValue   = 0;
            server.totalAmount    = 0;
            server.actionTime     = Date.now();
            server.hosts          = new Map();
            server.lastAction     = "";
            server.diffAvailMoney = moneyFormat(0);
            server.totalAmount    = 0;
            server.diffSecuriry   = 0;
            server.startTime      = 0;
            server.endTime        = 0;
            server.hosts          = new Map();
            updateInfo(ns, server);
            servers.set(server.name, server);
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
