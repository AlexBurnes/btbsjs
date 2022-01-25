const Module  = 'log.js';
const Version = '0.2.1';  // update this every time when edit the code!!!

/*
    logger
*/

const infoToastTimeout = 5000;
const logLevel   = 1;   // default log level
const debugLevel = 0;   // default debug level

import {Constants} from "lib-constants.js";
import {Socket} from "lib-network.js"

async function version(ns, port) {
    if (port !== undefined && port) {
        const socket = new Socket(ns, port);
        return socket.write(Version);
    }
    ns.tprintf("version %s", Version);
    return;
}

function help(ns) {
    ns.tprintf("usage: %s --version [--update-port] | --help", Module);
    ns.tprintf("this module is a library, import {Logger} from '%s'", Module);
    return;
}

/** @param {NS} ns **/
export async function main(ns) {
    const args = ns.flags([
        [ 'version'         , false     ],
        [ 'update-port'     , 0         ],
        [ 'help'            , true      ]
    ]);

    if (args['version']) {
        return version(ns, args['update-port']);
    }
    if (args['help']) {
        return help(ns);
    }
    help();
    return;
}

export class Logger {
    constructor(ns, options = {}) {
        this.ns = ns;
        this.file = false;
        this.debugLevel = options["debugLevel"] || 0; //default debug level
        this.logLevel = options["logLevel"] || 1; //default log level
    }
    // debug
    ld(level, format, ...args) {
        if (typeof(level) !== "number") throw Error("BUG: wrong usage of Logger.log(level, format, ..args), wrong type of argument level, expected number");
        if (this.debugLevel == 0 || level > this.debugLevel) return;
        this.ns.tprintf("#DEBUG: %s", this.ns.vsprintf(format, args));
    }
    // log
    lg(level, format, ...args) {
        if (typeof(level) !== "number") throw Error("BUG: wrong usage of Logger.log(level, format, ..args), wrong type of argument level, expected number");
        if (this.logLevel == 0 || level > this.logLevel) return;
        this.ns.tprintf("%s", this.ns.vsprintf(format, args));
    }
    // log result, always without level, and this could be toasted
    lr(format, ...args) {
        const text = this.ns.vsprintf(format, args);
        this.ns.tprintf("%s", text);
        ns.toas(text, "info", infoToastTimeout);
        return;
    }
    // log error, allways without level
    le(format, ...args) {
        this.ns.tprintf("ERROR: %s", this.ns.vsprintf(format, args));
    }
}
