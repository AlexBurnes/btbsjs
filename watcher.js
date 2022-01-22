// watcher.js
// version 0.1.0

/*
    listen port and output events info
    watch for hack,grow,weaken actions and output server affected information

*/

import {costFormat, timeFormat} from "lib-units.js"
import {Server, serversList} from "lib-server-list.js"
import {updateInfo} from "lib-server-info-full.js"
import {Logger} from "log.js"

const receivePort = 1;
const sendPort = 2;
const protocolVersion = 1;
const debugLevel = 0;
const logLevel = 1;

async function actionStart(lg, servers, time, data) {
    const ns = lg.ns;
    const [host, threads, server, method, end] = data;

    if (servers[server]) {
        let target = servers[server];
        if (target.actionTime <= time) {    // ingore old events
        target.currentAction  = method;
        target.currentThreads = threads;
        target.currentValue   = 0;
        target.startTime      = time;
        target.endTime        = end;
        updateInfo(ns, target);
        }
    }
    const estimate = new Date(Date.now + end).toUTCString().substr(17, 8);
    lg.debug(1, "start on host '%s' target '%s' action '%s' threads %d start time %d, %s",
    host, server, method, threads, time, estimate
    );
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

    if (servers[server]) {
        const target = servers[server];
        const currentTarget = new Server(server);

        lg.debug(1, "%s event time %d target action %s time %d", server, time, target.currentAction, target.actionTime);

        if (target.currentAction !== "" && target.startTime == eventTime) { // ignore event if action time is older
            updateInfo(ns, currentTarget);

            currentTarget.currentAction = "";
            currentTarget.currentThreads = 0;
            currentTarget.currentValue = result;
            currentTarget.actionTime = Date.now();
            currentTarget.diffAvailMoney = costFormat(Math.abs(currentTarget.availMoney.value - target.availMoney.value));
            currentTarget.diffSecuriry   = currentTarget.currentSecurity - target.currentSecurity;
            currentTarget.diffHackChance = currentTarget.hackChances/target.hackChances;
            currentTarget.diffHackTime   = currentTarget.hackTime.value/target.hackTime.value;
            currentTarget.diffGrowTime   = currentTarget.growTime.value/target.growTime.value;
            currentTarget.diffWeakTime   = currentTarget.weakTime.value/target.weakTime.value;
            const timeSpent = timeFormat((Date.now() - target.startTime)/1000);
            lg.log(1, "target '%s' action '%s' spent %.2f%s  value %s affects money %s%.2f%s chance %.2f(%.2f) security %.2f(%.2f) times hack %.2f grow %.2f weak %.2f",
                server, method, timeSpent.time, timeSpent.unit, resultStr,
                currentTarget.availMoney.value > target.availMoney.value
                ? "+"
                : currentTarget.availMoney.value == target.availMoney.value
                    ? ""
                    : "-",
                currentTarget.diffAvailMoney.cost, currentTarget.diffAvailMoney.unit,
                currentTarget.hackChances, currentTarget.diffHackChance,
                currentTarget.currentSecurity, currentTarget.diffSecuriry,
                currentTarget.diffHackTime, currentTarget.diffGrowTime, currentTarget.diffWeakTime
            );

            //replace target
            servers[server] = currentTarget;
        }
    }

}

async function actionCtrl(lg, servers, time, data) {
    const ns = lg.ns;
    lg.log(1, "@ %s", data.join(", "));
    /*const data = Object.keys(servers)
    .map(name => {
        const server = servers[name];
        return ns.sprintf("%s,%s,%s,%s", name, server.currentAction, server.currentThreads, server.currentValue);
    })
    .join(";");
    */
    await ns.tryWritePort(sendPort, ns.sprintf("%d # %s", Date.now(), data));
}

/** @param {NS} ns **/
export async function main(ns) {

    const lg = new Logger(ns, {logLevel: logLevel, debugLevel: debugLevel});

    let servers = new Map();
    serversList(ns)
    .forEach(server => {
        server.currentAction  = "";
        server.currentThreads = 0;
        server.currentValue   = 0;
        server.actionTime = Date.now();
        updateInfo(ns, server);
        servers[server.name] = server;
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
            }
            continue;
        }
        oldTime = Date.now();
        await ns.sleep(1000);
    }
}
