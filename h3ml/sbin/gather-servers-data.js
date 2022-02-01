const Module  = '/h3ml/sbin/gahter-servers-data.js';
const Version = '0.3.3.13'; // update this every time when edit the code!!!

import {Constants}      from "/h3ml/lib/constants.js";
import {Logger}         from "/h3ml/lib/log.js"
import {Servers}        from "/h3ml/lib/server-list.js"

const serversFile = Constants.serversFile;

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
    ns.tprintf("gather security rate into %s", securityFile);
    return;
}

async function updateServersFile(l, host) {
    const ns = l.ns;
    // prepare script source code
    let data = "export const serversData = {\n";
    let i = 0;
    Servers.list(ns)
        .forEach(server => {
            data += i++ ? ",\n" : "";
            data += "    '" + server.name+ "': {\n";
            const serverData = ns.getServer(server.name);
            data += "        'serverGrowth': "      + serverData.serverGrowth + ",\n";
            data += "        'maxRam': "            + ns.getServerMaxRam(server.name) + ",\n";
            data += "        'minSecutiry': "       + ns.getServerMinSecurityLevel(server.name) + ",\n";
            data += "        'maxMoney': "          + ns.getServerMaxMoney(server.name) + ",\n";
            data += "        'hackDifficulty': "    + ns.getServerRequiredHackingLevel(server.name) + ",\n";
            data += "        'factionServer': "     +
                (
                    ns.getServerMaxRam(server.name) >= 0 &&
                    ns.getServerMaxMoney(server.name) == 0 &&
                    ns.getServerRequiredHackingLevel(server.name) > 1
                    ? 1
                    : 0
                ) + ",\n";
            data += "        'ownServer': "     +
                (
                    ns.getServerMaxRam(server.name) > 0 &&
                    ns.getServerMaxMoney(server.name) == 0 &&
                    ns.getServerRequiredHackingLevel(server.name) == 1
                    ? 1
                    : 0
                );
            data += "\n    }";
        });
    data += "\n};";
    // write it
    await ns.write(serversFile, data, "w");
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

    const l = new Logger(ns, {args: args});
    const [host] = args["_"];
    if (host == undefined) {
        return l.e("host is undefined");
    }

    await updateServersFile(l);
}
