const Module  = '/h3ml/bin/scan.js';
const Version = '0.3.2.25'; // update this every time when edit the code!!!

import {Constants}  from "/h3ml/lib/constants.js";
import {Logger}     from "/h3ml/lib/log.js"         // this need only for modules

const scripts = [
    '/h3ml/lib/scan-info-with-contracts',
    '/h3ml/lib/scan-info',
    '/h3ml/lib/scan-simple'
];

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
    ns.tprintf("scan servers deeply and output them in tree view"); // in case of a module
    return;
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

    const l = new Logger(ns, {args: args});
    l.g(1, "%s %s", Module, Version);


    const host = ns.getHostname();
    const availMemory = ns.getServerMaxRam(host) - ns.getServerUsedRam(host);
    let pid;
    scripts.reverse().forEach(f => {
        if (!pid) {
            const scriptMem = ns.getScriptRam(f + '.js');
            if (scriptMem <= availMemory) {
                pid = ns.run(f + '.js', 1);
            }
        }
    });
    if (!pid) {
        l.e("not enought memory on host '%s' to run scan", host);
    }
}
