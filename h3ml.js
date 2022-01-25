// h3ml.js
// version 0.1.10
// hack them all

import {Logger} from "log.js";
import {serversList} from "lib-server-list.js"

const protocolVersion = 2;

const receivePort = 1;
const ctrlPort = 2;
const listenPort = 3;

const debugLevel = 0;
const logLevel = 1;

async function listHackingServers(lg, timeout) {
    const ns = lg.ns;
    const start = Date.now();
    await ns.tryWritePort(1, ns.sprintf("%d|%d|@|%d|server-hacking-list", start, protocolVersion, listenPort));
    while (Date.now() - start < timeout) { //wait 5 seconds
        const str = await ns.readPort(listenPort);
        if (str !== "NULL PORT DATA") {
            const [time, version, action, ...data] = str.split("|");
            if (time == undefined || version == undefined || version != protocolVersion) continue;
            lg.debug(1, "%d %s: %s", time, action, data.join(", "));
            if (action == "#") {
                if (data[0] == "server-hacking-list") {
                    const list = data[1].split(",").filter(server => !server.match(/^$/));
                    lg.debug(1, "hacking servers %d", list.length);
                    if (list.length > 0) {
                        list.forEach(server => lg.debug(1, "\t%s", server));
                    }
                    return list;
                }
            }

        }
        await ns.sleep(100);
    }
    return [];
}

/** @param {NS} ns **/
export async function main(ns) {
    // ask wahter wich servers are hacking
    const lg = new Logger(ns);
    const hacking_list = await listHackingServers(lg, 5000);
    const hacking_servers = new Map();
    hacking_list.forEach(server => {hacking_servers.set(server, true);})

    serversList(ns)
        .filter(server => server.name !== 'home') // not home
        .filter(server => ns.getServerMaxMoney(server.name)) // has money
        .filter(server => ns.hasRootAccess(server.name)) // with root access
        .filter(server => ns.getServerRequiredHackingLevel(server.name) <= ns.getHackingLevel())
        .forEach(server => {
            if (hacking_servers.has(server.name)) {
                lg.log(1, "%s already haking", server.name);
            }
            else {
                const pid = ns.exec("server-hack.js", ns.getHostname(), 1, server.name);
                lg.log(1, "%s start hacking pid %d", server.name, pid);
            }
        });

        lg.log(1, "done");
}
