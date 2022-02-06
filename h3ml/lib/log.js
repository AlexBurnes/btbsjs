"use strict";
const Module  = '/h3ml/lib/log.js';
const Version = '0.3.3';  // update this every time when edit the code!!!

/*
    logger
*/

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
        this.logLevel   = options["logLevel"]   || Constants.logLevel;   //default log level
        this.quiet = 0;

        if (options["args"]) {
            const args = options["args"];
            this.debugLevel = args["debug"] || this.debugLevel;
            this.logLevel   = args["log"]   || this.logLevel;
            if (args["verbose"]) {
                this.logLevel = 1;
            }
            if (args["quiet"]) {
                this.quiet = 1;
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
        const text = this.ns.sprintf("DEBUG: %s", this.ns.vsprintf(format, args));
        this.ns.print(text);
        if (this.quiet) return;
        this.ns.tprintf("%s", text);
    }
    // log
    /** @param {Number} level 0..N **/
    /** @param {String} format sprintf **/
    /** @param {...Any} args **/
    g(level, format, ...args) {
        if (typeof(level) !== "number") throw Error("BUG: wrong usage of Logger.log(level, format, ..args), wrong type of argument level, expected number");
        if (this.logLevel == 0 || level > this.logLevel) return;
        //how about to log into log ?
        const text = this.ns.vsprintf(format, args);
        this.ns.print(text);
        if (this.quiet) return;
        this.ns.tprintf("%s", text);
        return;
    }
    // log result, always without level, and this may be toasted
    /** @param {String} format sprintf **/
    /** @param {...Any} args **/
    r(format, ...args) {
        const text = this.ns.vsprintf(format, args);
        this.ns.print(text);
        if (Constants.toastLogResult) {
            this.ns.toast(text, "info", Constants.toastInfoTimeout);
        }
        if (this.quiet) return;
        this.ns.tprintf("%s", text);
        return;
    }
    // log error, allways without level
    /** @param {String} format sprintf **/
    /** @param {...Any} args **/
    e(format, ...args) {
        const text = this.ns.sprintf("ERROR: %s", this.ns.vsprintf(format, args));
        this.ns.print(text);
        if (this.quiet) return;
        this.ns.tprintf("%s", text);
    }
    // log error, allways without level
    /** @param {String} format sprintf **/
    /** @param {...Any} args **/
    w(format, ...args) {
        const text = this.ns.sprintf("WARNING: %s", this.ns.vsprintf(format, args));
        this.ns.print(text);
        if (this.quiet) return;
        this.ns.tprintf("%s", text);
    }
}
