const Module  = '/h3ml/var/files.js';
const Version = '0.3.3.25';

import {Constants} from "/h3ml/lib/constants.js";

async function version(ns, port) {
    if (port !== undefined && port) {
        const data = ns.sprintf("%d|%s|%s", Date.now(), Module, Version);
        return ns.tryWritePort(Constants.updatePort, data);
    }
    ns.tprintf("module %s version %s", Module, Version);
    return;
}

function help(ns) {
    ns.tprintf("usage: %s --version [--update-port] | --help", Module);
    ns.tprintf("this is a file list of script files for uload by updater");
    return;
}

export const scriptFiles = [
    // aliases
    "/h3ml/etc/aliases.script",
    "/h3ml/etc/aliases-min.script",

    // libraries in order of dependencie
    "/h3ml/lib/network.js",
    "/h3ml/lib/backdoor.js",
    "/h3ml/lib/units.js",
    "/h3ml/lib/utils.js",
    "/h3ml/lib/server.js",
    "/h3ml/lib/server-min.js",
    "/h3ml/lib/server-list.js",
    "/h3ml/lib/server-info.js",
    "/h3ml/lib/server-info-min.js",
    "/h3ml/lib/botnet.js",
    "/h3ml/lib/botnet-min.js",
    "/h3ml/lib/target.js",
    "/h3ml/lib/target-min.js",
    "/h3ml/lib/hack-server.js",

    "/h3ml/lib/scan-simple.js",
    "/h3ml/lib/scan-info.js",
    "/h3ml/lib/scan-info-with-contracts.js",

    // script skeleton
    "/h3ml/var/module.js",
    "/h3ml/var/library.js",

    // scripts

    "/h3ml/bin/backdoor.js",
    "/h3ml/bin/connect.js",
    "/h3ml/bin/hack-net.js",
    "/h3ml/bin/scan.js",
    "/h3ml/bin/worm.js",

    "/h3ml/bin/h3ml.js",
    "/h3ml/bin/hack.js",
    "/h3ml/bin/grow.js",
    "/h3ml/bin/weak.js",

    "/h3ml/bin/hack-servers.js",
    "/h3ml/bin/share.js",

    "/h3ml/bin/start.js",
    "/h3ml/bin/stop.js",
    "/h3ml/bin/quiet.js",
    "/h3ml/bin/verbose.js",

    "/h3ml/bin/rm.js",

    "/h3ml/bin/server-buy.js",
    "/h3ml/bin/server-buy-min.js",
    "/h3ml/bin/server-rm.js",
    "/h3ml/bin/server-cost.js",

    "/h3ml/sbin/watcher.js",
    "/h3ml/sbin/watch-min.js",
    "/h3ml/sbin/worker.js",
    "/h3ml/sbin/sharing.js",
    "/h3ml/sbin/server-hack.js",
    "/h3ml/sbin/gather-security-data.js",
    "/h3ml/sbin/gather-servers-data.js",

    "/h3ml/sbin/setup.js",

    "/h3ml-update.js"
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


