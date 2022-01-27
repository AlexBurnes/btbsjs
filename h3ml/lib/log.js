const Module  = '/h3ml/lib/log.js';
const Version = '0.3.0';  // update this every time when edit the code!!!

/*
    logger
*/

import {Constants} from "/h3ml/lib/constants.js";
import {Socket}    from "/h3ml/lib/network.js"

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
    ns.tprintf("this module is a library, usage");
    ns.tprintf("\timport {Logger} from '%s'", Module);
    ns.tprintf("\tconst l = new Logger(ns, options)");
    ns.tprintf("\tl.g(1, \"some text with %s, %d\", string, number)");
    return;
}

/** @param {import("Ns").NS } ns **/
export async function main(ns) {
    const args = ns.flags([
        [ 'version'         , false ],
        [ 'update-port'     , 0     ],
        [ 'help'            , false ]
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

        this.debugLevel = options["debugLevel"] || Constants.debugLevel; //default debug level
        this.logLevel   = options["logLevel"]   || constants.logLevel;   //default log level

        if (options["args"]) {
            const args = options["args"];
            this.debugLevel = args["debugLevel"] || this.debugLevel;
            this.logLevel   = args["logLevel"]   || this.logLevel;
            if (args["verbose"]) {
                this.logLevel = 1;
            }
            if (args["quiet"]) {
                this.logLevel   = 0;
                this.debugLevel = 0;
            }
        }

    }
    // debug
    /** @param {Number} level 0..N **/
    /** @param {String} format sprintf **/
    /** @param {...Any} args **/
    d(level, format, ...args) {
        if (typeof(level) !== "number") throw Error("BUG: wrong usage of Logger.log(level, format, ..args), wrong type of argument level, expected number");
        if (this.debugLevel == 0 || level > this.debugLevel) return;
        this.ns.tprintf("#DEBUG: %s", this.ns.vsprintf(format, args));
    }
    // log
    /** @param {Number} level 0..N **/
    /** @param {String} format sprintf **/
    /** @param {...Any} args **/
    g(level, format, ...args) {
        if (typeof(level) !== "number") throw Error("BUG: wrong usage of Logger.log(level, format, ..args), wrong type of argument level, expected number");
        if (this.logLevel == 0 || level > this.logLevel) return;
        this.ns.tprintf("%s", this.ns.vsprintf(format, args));
    }
    // log result, always without level, and this may be toasted
    /** @param {String} format sprintf **/
    /** @param {...Any} args **/
    r(format, ...args) {
        const text = this.ns.vsprintf(format, args);
        this.ns.tprintf("%s", text);
        if (Constants.toastLogResult) {
            ns.toast(text, "info", Constants.toastInfoTimeout);
        }
        return;
    }
    // log error, allways without level
    /** @param {String} format sprintf **/
    /** @param {...Any} args **/
    e(format, ...args) {
        this.ns.tprintf("ERROR: %s", this.ns.vsprintf(format, args));
    }
    // log error, allways without level
    /** @param {String} format sprintf **/
    /** @param {...Any} args **/
    w(format, ...args) {
        this.ns.tprintf("WARNING: %s", this.ns.vsprintf(format, args));
    }
}
