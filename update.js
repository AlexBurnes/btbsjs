const Module  = 'update.js'; // replace by name of new module
const Version = '0.2.0';     // update this every time when edit the code!!!

const baseUrl    = "https://raw.githubusercontent.com/AlexBurnes/btbsjs/devel/";
const files_list = ["file-list.js", "update-fetch.js", "lib-constants.js", "lib-network.js", "log.js"];

const logLevel   = 1;   // default log level
const debugLevel = 0;   // default debug level

import {Constants}  from "lib-constants.js";
import {Logger}     from "log.js"

async function version(ns, port) {
    if (port !== undefined && port) {
        const data = ns.sprintf("%d|%d|%s|%s", Date.now(), Constants.protocolVersion, Module, Version);
        return ns.tryWritePort(Constants.updatePort, data);
    }
    ns.tprintf("version %s", Version);
    return;
}

function help(ns) {
    ns.tprintf("usage: %s --version [--update-port] | --help", Module);
    ns.tprintf("update script from github");
    return;
}

/** @param {NS} ns **/
export async function main(ns) {
    const args = ns.flags([
        [ 'version'         , false     ],
        [ 'update-port'     , 0         ],
        [ 'help'            , false     ]
    ]);

    if (args['version']) {
        return version(ns, args['update-port']);
    }
    if (args['help']) {
        return help(ns);
    }
    // do not use anything from current libraries
    await update(ns);
    ns.tprintf("done updating");
    return;
}

/** @param {import("Ns").NS } ns */
async function update(ns) {
    const host = ns.getHostname();
    for(i = 0; i < files_list.length; i++) {
        const file = files_list[i];
        await ns.wget(`${baseUrl}${file}`, file);
        if (!ns.fileExists(file, host)) {
            ns.tprintf("failed get file for update %s/%s", baseUrl, file);
            return;
        }
    }

    await ns.run("update-fetch.js", 1, baseUrl);

}
