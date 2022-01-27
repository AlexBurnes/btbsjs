const Module  = 'module.js'; // replace by name of new module
const Version = '0.2.0';     // update this every time when edit the code!!!

/*
    h3ml - hack them all, start server-hack for hackable targets
*/

const debugLevel = 0;
const logLevel   = 1;

import {Constants} from "lib-constants.js";
import {Socket} from "lib-network.js"
import {serversList} from "lib-server-list.js"
import {Logger} from "log.js";

const protocolVersion   = Constants.protocolVersion;
const watchPort         = Constants.watchPort;
const infoPort          = Constants.infoPort;

async function version(ns, port) {
    if (port !== undefined && port) {
        const socket = new Socket(ns, port);
        return socket.write(Version);
    }
    ns.tprintf("version %s", Version);
    return;
}

function help(ns) {
    ns.tprintf("usage: %s --version [--update-port] [--help]", Module);
    ns.tprintf("start server-hack script for hackable servers on 'home' or 'hack-server' if exists");
    return;
}

async function listHackingServers(lg, timeout) {
    const ns = lg.ns;
    const start = Date.now();
    await ns.tryWritePort(watchPort, ns.sprintf("%d|%d|@|%d|server-hacking-list", start, protocolVersion, infoPort));
    while (Date.now() - start < timeout) { //wait 5 seconds
        const str = await ns.readPort(infoPort);
        if (str !== "NULL PORT DATA") {
            const [time, version, action, ...data] = str.split("|");
            if (time == undefined || version == undefined || version != protocolVersion) continue;
            l.d(1, "%d %s: %s", time, action, data.join(", "));
            if (action == "#") {
                if (data[0] == "server-hacking-list") {
                    const list = data[1].split(",").filter(server => !server.match(/^$/));
                    l.d(1, "hacking servers %d", list.length);
                    if (list.length > 0) {
                        list.forEach(server => l.d(1, "\t%s", server));
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
    const args = ns.flags([
        [ 'version'         , false ],
        [ 'update-port'     , 0     ],
        [ 'help'            , false ]
    ]);

    if (args['version']) {
        return version(ns, args['update-port']);
    }
    if (args['help']) {
        return help(ns);
    }
    const lg = new Logger(ns, {logLevel : logLevel, debugLevel: debugLevel});

    const hacking_list = await listHackingServers(lg, 5000);
    const hacking_servers = new Map();
    hacking_list.forEach(server => {hacking_servers.set(server, true);})

    //server-hack script could be started only on hack-server or home :)
    const hack_server = ns.serverExists("hack-server-0") ? "hack-server-0" : "home";

    serversList(ns)
        .filter(server => server.name !== 'home') // not home
        .filter(server => server.name !== 'ctrl-server') // not home
        .filter(server => ns.getServerMaxMoney(server.name)) // has money
        .filter(server => ns.hasRootAccess(server.name)) // with root access
        .filter(server => ns.getServerRequiredHackingLevel(server.name) <= ns.getHackingLevel())
        .forEach(server => {
            if (hacking_servers.has(server.name)) {
                l.g(1, "%s already haking", server.name);
            }
            else {
                const pid = ns.exec("server-hack.js", hack_server, 1, server.name);
                l.g(1, "%s start hacking at '%s' pid %d", server.name, hack_server, pid);
            }
        });

        l.g(1, "done");
}
