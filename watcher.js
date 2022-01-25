// watcher.js
// version 0.1.10

/*
    listen port and output events info
    watch for hack,grow,weaken actions and output server affected information

*/

const protocolVersion = 2;

import {costFormat, timeFormat} from "lib-units.js"
import {Server, serversList} from "lib-server-list.js"
import {updateInfo} from "lib-server-info-full.js"
import {Logger} from "log.js"

const receivePort = 1;
const sendPort = 2;

const debugLevel = 0;
const logLevel = 1;

let quietMode = 0;

async function actionStart(lg, servers, time, data) {
    const ns = lg.ns;
    const [host, threads, server, method, end] = data;

    if (servers.get(server)) {
        const target = servers.get(server);
        if (target.actionTime <= time) {
            if (target.actionTime < time) {     // new action group events
                target.currentAction  = method;
                target.currentThreads = threads;
                target.currentValue   = 0;
                target.actionTime     = time;
                target.startTime      = time;
                target.endTime        = end;
                updateInfo(ns, target);
                target.hosts = new Map();
            }
            const hostServer = new Server(host);
            target.hosts.set(host, hostServer);
            hostServer.currentAction  = method;
            hostServer.currentThreads += threads;
            hostServer.currentValue   = 0;
            hostServer.startTime      = time;
            hostServer.endTime        = end;
        }
        const estimate = new Date(Date.now + end).toUTCString().substr(17, 8);
        lg.debug(1, "start on host '%s' target '%s' action '%s' threads %d start time %d, %s, wait hosts %d",
            host, server, method, threads, time, estimate, target.hosts.size
        );
    }
}

async function actionStop(lg, servers, time, data) {
    const ns = lg.ns;
    const [host, threads, eventTime, server, method, result] = data;
    let resultStr = "";
    switch (method) {
        case "weaken":
            resultStr = ns.sprintf("%.2f", result);
            break;
        case "grow":
            resultStr = ns.sprintf("%.2f", result);
            break;
        case "hack":
            const amount = costFormat(result);
            resultStr = ns.sprintf("%.2f%s", amount.cost, amount.unit);
            break;
    }

    lg.debug(1, "stop on host '%s' target '%s' action '%s' threads %d result %s start time %d",
        host, server, method, threads, resultStr, eventTime
    );

    if (servers.get(server)) {
        const target = servers.get(server);
        const currentTarget = new Server(server);

        lg.debug(1, "%s event time %d target action %s time %d host %s, wait hosts %d",
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
                currentTarget.diffAvailMoney = costFormat(Math.abs(currentTarget.availMoney.value - target.availMoney.value));
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
                        lg.log(1, "<= '%s' %s => %s%.2f -> %.2f / %.2f in %.2f%s",
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
                        lg.log(1, "<= '%s' %s => %s%.2f%s -> %.2f%s / %.2f%s in %.2f%s",
                            server, method,
                            currentTarget.availMoney.value > target.availMoney.value
                                ? "+"
                                : currentTarget.availMoney.value == target.availMoney.value
                                    ? ""
                                    : "-",
                            currentTarget.diffAvailMoney.cost, currentTarget.diffAvailMoney.unit,
                            currentTarget.availMoney.cost, currentTarget.diffAvailMoney.unit,
                            currentTarget.maxMoney.cost,   currentTarget.maxMoney.unit,
                            timeSpent.time, timeSpent.unit
                       );
                    }
                }
                //replace target
                servers.set(server, currentTarget);

                //ns.run("server-analyze.js", 1, server);

            }
        }
    }

}

async function actionCtrl(lg, servers, time, data) {
    const ns = lg.ns;

    const port = data[0];

    if (quietMode == 0) lg.log(1, "ctrl receive %s, port %d", data[1], data[0]);

    switch (data[1]) {
        case "server-hacking-list":
            const scripts = new Map();
            const procs = await ns.ps(ns.getHostname());
            procs
                .filter(proc => proc.filename = "server-hack.js")
                .forEach(proc => {
                    scripts.set(proc.args[0], true)
                });
            const list = new Array();
            servers.forEach((server, key) => {
                lg.debug(1, "server %s, action %s", server.name, server.currentAction);
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

async function actionInfo(lg, servers, time, data) {
    const ns = lg.ns;

    if (quietMode == 0) lg.log(1, "%s", data.join(", "));
    return;
}

/** @param {NS} ns **/
export async function main(ns) {

    const lg = new Logger(ns, {logLevel: logLevel, debugLevel: debugLevel});

    const servers = new Map();
    serversList(ns)
        .forEach(server => {
            server.currentAction  = "";
            server.currentThreads = 0;
            server.currentValue   = 0;
            server.totalAmount    = 0;
            server.actionTime     = Date.now();
            server.hosts          = new Map();
            server.lastAction     = "";
            server.diffAvailMoney = costFormat(0);
            server.totalAmount    = 0;
            server.diffSecuriry   = 0;
            server.startTime      = 0;
            server.endTime        = 0;
            updateInfo(ns, server);
            servers.set(server.name, server);
        });

    // drop all old events
    let oldTime = Date.now();
    lg.debug(1, "time %d", oldTime);

    while (true) {
        const str = await ns.readPort(receivePort);
        if (str !== "NULL PORT DATA") {
            lg.debug(1, "time %d", oldTime);
            const [time, version, action, ...data] = str.split("|");
            if (time == undefined || version == undefined || version != protocolVersion) continue; //failed
            lg.debug(1, "%d %s: %s", time, action, data.join(", "));
            if (time < oldTime) continue; // do not read old events from port
            switch (action) {
                case '<':
                    // stop method
                    await actionStop(lg, servers, time, data);
                    break;
                case '>':
                    // start method
                    await actionStart(lg, servers, time, data);
                    break;
                case '@':
                    // request stat
                    await actionCtrl(lg, servers, time, data);
                    break;
                case '#':
                    //info to output
                    await actionInfo(lg, servers, time, data);
            }
            continue;
        }
        oldTime = Date.now();

        //FIXME need function to check wait sto events from servers;
        // need event driven mechanism, like listent + on receive
        await ns.sleep(100);
    }
}
