const Module  = '/h3ml/bin/hack-servers.js';
const Version = '0.3.5.5'; // update this every time when edit the code!!!

import {Constants}  from "/h3ml/lib/constants.js";
import {Logger}     from "/h3ml/lib/log.js";
import {Servers}    from "/h3ml/lib/server-list.js";
import {Server}     from "/h3ml/lib/server.js";
import {BotNet}     from "/h3ml/lib/botnet.js";
import {Socket}     from "/h3ml/lib/network.js";
import {hackInfo}   from "/h3ml/lib/hack-server.js";
import {Units}      from "/h3ml/lib/units.js";

const protocolVersion = Constants.protocolVersion;
const watchPort       = Constants.watchPort;
const infoPort        = Constants.infoPort;

async function version(ns, port) {
    if (port !== undefined && port) {
        const data = ns.sprintf("%d|%s|%s", Date.now(), Module, Version);
        return ns.tryWritePort(port, data);
    }
    ns.tprintf("module %s version %s", Module, Version);
    return;
}

/**
    @param {NS} ns
    @param {Number} port
**/
function help(ns) {
    ns.tprintf("usage: %s --version [--update-port] | --help", Module);
    ns.tprintf("module description");
    return;
}

async function listHackingServers(l, timeout) {
    const ns = l.ns;
    const start = Date.now();
    const watchSocket = new Socket(ns, watchPort);
    const infoSocket  = new Socket(ns, infoPort);
    await watchSocket.write("@", infoPort, "server-hacking-list");
    const [time, data] = await infoSocket.read({time: start, timeout: timeout});
    l.d(1, "read time %d, action %s, info %s", time, data.join(','));
    if (data[0] == "#") {
        if (data[1] == "server-hacking-list") {
            const list = data[2].split(";").filter(server => !server.match(/^$/));
            l.d(1, "hacking servers %d", list.length);
            if (list.length > 0) {
                list.forEach(server => l.d(1, "\t%s", server));
            }
            return list;
        }
    }
    return [];
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
        [ 'quiet'       , false ]
    ]);

    if (args['version']) {
        return version(ns, args['update-port']);
    }
    if (args['help']) {
        return help(ns);
    }

    ns.disableLog("ALL");

    // for modules
    const l = new Logger(ns, {args: args});

    const tail = args["_"][0] == "tail" ? true : false;

    if (tail) ns.tail(Module, ns.getHostname(), "tail");

    while (true) {
        const hacking_list = await listHackingServers(l, 5000);
        const hacking_servers = new Map();
        hacking_list.forEach(item => {
            const server = item.split(",");
            const timeout = server[2] - Date.now() + parseInt(server[3]);
            const now = Date.now();
            const estimate = Units.time(server[1] !== undefined && timeout > 0 ? timeout/1000 : 0);
            const diff_amount = Units.money(server[5]);
            const total_amount = Units.money(server[6]);
            const diff_security = server[7];
            const hack_info = [
                server[0],
                server[1],
                estimate,
                server[4],
                diff_amount,
                diff_security,
                total_amount
            ];
            //l.d(1, "\t%s data: %s", server[0], server.join(","));
            hacking_servers.set(server[0], hack_info);
        });

        const servers = Servers.list(ns, Server)
            .filter(server => server.name !== 'home') // not home
            .filter(server => ns.getServerMaxMoney(server.name)) // has money
            .filter(server => ns.hasRootAccess(server.name)) // with root access
            .filter(server => ns.getServerRequiredHackingLevel(server.name) <= ns.getHackingLevel()); // hackable


        const botnet = new BotNet(ns);
        const botnetData =
            ns.sprintf("botnet %d memory %dGb max threads %d, free %d, used memory %dGb usage %.2f%%",
                botnet.servers.length, botnet.maxRam, botnet.maxWorkers, botnet.workers,
                botnet.usedRam, 100 * botnet.usedRam / botnet.maxRam
            );
        const data = hackInfo(l, botnet, servers, hacking_servers);
        if (!tail) {
            l.g(1, "output data and break");
            l.g(1, "%s", botnetData);
            l.g(1, "%s", data.join("\n"));
            break;
        }
        ns.clearLog();
        ns.print(botnetData);
        ns.print(data.join("\n"));
        await ns.sleep(1000);
    }
}
