const Module  = '/h3ml/sbin/gahter-servers-data.js';
const Version = '0.3.3'; // update this every time when edit the code!!!

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
    // if file exists delete it
    if (ns.fileExists(serversFile, host)) {
        ns.rm(serversFile, host);
    }
    // prepare script source code
    let data = "export const serversData = {\n";
    let i = 0;
    Servers.list().forEach(server => {
        data += i++ ? ", " : "";
        data += "\t'" + server.name+ "': ";
        const serverData = ns.getServer(server.name);
        data += "\t\t'serverGrowth': " + serverData.serverGrowth + ",\n";
        data += "\t\t'maxRam': " + ns.getServerMaxRam(server.name) + ",\n";
        data += "\t\t'hackDifficulty': " + ns.getServerRequiredHackingLevel(server.name) + ",\n";
        data += "\t\t'factionServer': " + ns.getServerMaxRam(server.name) == 0 && ns.getServerMaxMoney(server.name) == 0 ? 1 : 0;
        data += "\t}";
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

    const [host] = args["_"];
    if (host == undefined) {
        return l.e("host is undefined");
    }

    await updateServersFile(l);
}
