const Module  = '/h3ml/bin/hack-servers.js';
const Version = '0.3.3.16'; // update this every time when edit the code!!!

import {Constants}  from "/h3ml/lib/constants.js";
import {Logger}     from "/h3ml/lib/log.js";
import {Server}     from "/h3ml/lib/server-list.js"
import {BotNet}     from "/h3ml/lib/botnet.js"
import {Target}     from "/h3ml/lib/target.js"
import {Table}      from "/h3ml/lib/utils.js"
import {hackInfo} from "/h3ml/lib/hack-server.js"
import {Units} from "/h3ml/lib/units.js"

const protocolVersion   = Constants.protocolVersion;
const watchPort         = Constants.infoPort;
const ctrlPort          = Constants.ctrlPort;
const infoPort        = Constants.infoPort;

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
    ns.tprintf("usage: %s --version [--update-port] | --help", Module);
    ns.tprintf("module description");
    return;
}

async function listHackingServers(l, timeout) {
    const ns = l.ns;
    const start = Date.now();
    await ns.tryWritePort(1, ns.sprintf("%d|%d|@|%d|server-hacking-list", start, protocolVersion, infoPort));
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

    // for modules
    const l = new Logger(ns, {args: args});
    l.g(1, "%s %s", Module, Version);

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

    const servers = Servers.list(ns)
        .filter(server => server.name !== 'home') // not home
        .filter(server => ns.getServerMaxMoney(server.name)) // has money
        .filter(server => ns.hasRootAccess(server.name)) // with root access
        .filter(server => ns.getServerRequiredHackingLevel(server.name) <= ns.getHackingLevel()); // hackable

    const botnet = new BotNet(ns);
    l.g(1, "botnet %d memory %dGb max threads %d, used memory %dGb usage %.2f%%",
        botnet.servers.length, botnet.maxRam, botnet.workers,
        botnet.usedRam, 100 * botnet.usedRam / botnet.maxRam
    );

    hackInfo(l, botnet, servers, hacking_servers);

}
