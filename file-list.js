const Module  = 'file-list.js'; // replace by name of new module
const Version = '0.2.1';     // update this every time when edit the code!!!

import {Constants} from "lib-constants.js";

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
    ns.tprintf("this is a file list of script files for uload by updater");
    return;
}

export const scriptFiles = [
    // file list and aliases
    "aliases.script",
    "file-list.js",

    // libraries in order of dependencie
    "lib-constants.js",
    "lib-network.js",
    "lib-log.js",
    "lib-units.js",
    "lib-utils.js",
    "lib-server-list.js",
    "lib-target.js",
    "lib-botnet.js",
    "lib-server-info.js",
    "lib-server-info-full.js",
    "lib-hack-server.js",
    "install-backdoor.js",

    // script skeleton
    "module.js",

    // scripts
    "scan.js",
    "scan-info-with-contracts.js",
    "scan-info.js",
    "scan-simple.js",
    "watcher.js",
    "stop.js",
    "backdoor.js",
    "connect.js",
    "worm.js",

    "server-buy.js",
    "server-rm.js",
    "server-cost.js",

    "h3ml.js",
    "hack-net.js",
    "hack-servers.js",
    "hacking.js",

    "server-analyze.js",
    "server-hack.js",

    "target.js",
    "hack.js",
    "grow.js",
    "weak.js",
    "worker.js",

    "watcher.js",
    "quiet.js",
    "verbose.js",

    "update.js",

    "rm.js"
];

/** @param {NS} ns **/
export async function main(ns) {
    const args = ns.flags([
        [ 'version'     , false ],
        [ 'update-port' , 0     ],
        [ 'help'        , false ]
    ]);

    if (args['version']) {
        return version(ns, args['update-port']);
    }
    if (args['help']) {
        return help(ns);
    }
    return;
}


