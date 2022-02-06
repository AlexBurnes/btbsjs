"use strict";
const Module  = '/h3ml/lib/network.js';
const Version = '0.3.5.4';

/*
    network interaction, read, write, listen

*/

import {Constants} from "/h3ml/lib/constants.js";

async function version(ns, port) {
    if (port !== undefined && port) {
        const data = ns.sprintf("%d|%s|%s", Date.now(), Module, Version);
        return ns.tryWritePort(port, data);
    }
    ns.tprintf("module %s version %s", Module, Version);
}

function help(ns) {
    ns.tprintf("usage: %s --version [--update-port] [--help]", Module);
    ns.tprintf("this module is a library, import {Socket} from '%s'", Module);
}

export class Socket {
    constructor(ns, port) {
        this.ns = ns;
        this.version = Constants.protocolVersion;
        this.port = port;
        this.time = Date.now();
    }
    async read(options = {}) {
        if (!this.port) return [0, ""];
        const ns = this.ns;
        const start = options.time || Date.now();
        while (true) {
            const str = await ns.readPort(this.port);
            if (str !== "NULL PORT DATA") {
                const [time, version, ...data] = str.split("|");
                if (time == undefined || version == undefined || version != this.version) continue; //failed
                if (time < this.time) continue;
                return [time, data];
            }
            if (options.timeout && Date.now() - start >= options.timeout) break;
            await ns.sleep(100);
        }
        return [0, []];
    }
    async write(...data) {
        if (!this.port) return;
        const ns = this.ns;
        return await ns.tryWritePort(this.port, ns.sprintf("%d|%d|%s", Date.now(), this.version, data.join('|')));
    }
    /* @param {(time, string){}} collaback*/
    async listen(callback, options = {}) {
        if (!this.port) return;
        const ns = this.ns;
        const timeout = options.timeout || 100;
        while(true) {
            const start = Date.now();
            while (true) {
                const str = ns.readPort(this.port);
                if (str !== "NULL PORT DATA") {
                    const [time, version, ...data] = str.split("|");
                    if (time == undefined || version == undefined || version != this.version) continue; //failed
                    if (time < this.time) continue; // do not read old events from port
                    if (!await callback(time, data)) return;
                    if (options.idle && Date.now() - start > timeout) await options.idle();
                    continue;
                }
                break;
            }
            this.time = Date.now();
            if (options.idle) if (!await options.idle()) return;
            if (Date.now() - start > timeout) continue;
            await ns.sleep(timeout);
        }
    }
}


/** @param {NS} ns **/
export async function main(ns) {
    const args = ns.flags([
        ['version'      , false ],
        ['update-port'  , 0     ],
        ['help'         , true  ]
    ]);

    if (args['version']) {
        return version(ns, args['update-port']);
    }
    help(ns);

    return;
}
