const Module  = 'module.js'; // replace by name of new module
const Version = '0.2.0';     // update this every time when edit the code!!!

/*
    minimal application immplementation

*/

const logLevel   = 1;   // default log level
const debugLevel = 0;   // default debug level

import {Constants} from "lib-constants.js";
import {Logger} from "log.js"

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
    ns.tprintf("this module is a library, import {some} from '%s'", Module); // in case of a library
    ns.tprintf("module description"); // in case of a module
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
    const lg = new Logger(ns, {logLevel : logLevel, debugLevel: debugLevel});

    return;
}
