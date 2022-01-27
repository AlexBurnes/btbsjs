const Module  = 'var/files.js';
const Version = '0.2.1';

import {Constants} from "lib/constants.js";

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
    "etc/aliases.script",
    "var/file-list.js",

    // libraries in order of dependencie
    "lib/constants.js",
    "lib/network.js",
    "lib/log.js",
    "lib/units.js",
    "lib/utils.js",
    "lib/server-list.js",
    "lib/target.js",
    "lib/botnet.js",
    "lib/server-info.js",
    "lib/server-info-full.js",
    "lib/hack-server.js",
    "lib/backdoor.js",

    // script skeleton
    "var/module.js",

    // scripts
    "bin/scan.js",
    "lib/scan-info-with-contracts.js",
    "lib/scan-info.js",
    "lib/scan-simple.js",

    "bin/stop.js",
    "bin/backdoor.js",
    "bin/connect.js",
    "bin/worm.js",

    "bin/server-buy.js",
    "bin/server-rm.js",
    "bin/server-cost.js",

    "bin/h3ml.js",
    "bin/hack-net.js",
    "bin/hack-servers.js",

    "bin/server-analyze.js",
    "bin/server-hack.js",

    "bin/hack.js",
    "bin/grow.js",
    "bin/weak.js",
    "bin/worker.js",

    "bin/quiet.js",
    "bin/verbose.js",
    "bin/rm.js"

    "sbin/watcher.js",
    "sbin/update.js",


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


