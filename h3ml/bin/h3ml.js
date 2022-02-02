const Module  = '/h3ml/bin/h3ml.js';
const Version = '0.3.3.26'; // update this every time when edit the code!!!

import {Constants}  from "/h3ml/lib/constants.js";
import {Logger}     from "/h3ml/lib/log.js";
import {Socket}     from "/h3ml/lib/network.js"
import {Servers}    from "/h3ml/lib/server-list.js"

const protocolVersion   = Constants.protocolVersion;
const watchPort         = Constants.watchPort;
const infoPort          = Constants.infoPort;

async function version(ns, port) {
    if (port !== undefined && port) {
        const data = ns.sprintf("%d|%s|%s", Date.now(), Module, Version);
        return ns.tryWritePort(port, data);
    }
    ns.tprintf("version %s", Version);
    return;
}

/**
    @param {NS} ns
    @param {Number} port
**/
function help(ns) {
    ns.tprintf("usage: %s --version [--update-port] [--help]", Module);
    ns.tprintf("start server-hack script for hackable servers on 'home' or 'hack-server' if exists");
    return;
}

async function listHackingServers(l, timeout) {
    const ns = l.ns;
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
                    const list = data[1].split(";").filter(server => !server.match(/^$/));
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

    const hacking_list = await listHackingServers(l, 5000);
    const hacking_servers = new Map();
    hacking_list.forEach(list => {
        data = list.split(',');
        hacking_servers.set(data[0], true);
    });

    //server-hack script could be started only on hack-server or home :)
    const hack_server = ns.serverExists("hack-server") ? "hack-server" : "home";

    Servers.list(ns)
        .filter(server => server.name !== 'home') // not home
        .filter(server => server.name !== 'ctrl-server') // not home
        .filter(server => ns.getServerMaxMoney(server.name)) // has money
        .filter(server => ns.hasRootAccess(server.name)) // with root access
        .filter(server => ns.getServerRequiredHackingLevel(server.name) <= ns.getHackingLevel())
        .forEach(server => {
            if (hacking_servers.has(server.name)) {
                l.g(2, "%s already haking", server.name);
            }
            else {
                const pid = ns.exec("server-hack.js", hack_server, 1, server.name);
                if (pid) {
                    l.g(1, "%s start hacking at '%s' pid %d", server.name, hack_server, pid);
                }
                else {
                    l.e("failed start haking %s at %s", server.name, hack_server);
                }
            }
        });

        l.g(1, "done");
}
