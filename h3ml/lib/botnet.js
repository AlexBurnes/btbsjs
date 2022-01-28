const Module  = '/h3ml/lib/botnet.js';
const Version = '0.3.2.19';     // update this every time when edit the code!!!

import {Constants} from "/h3ml/lib/constants.js";
import {Servers}   from "/h3ml/lib/server-list.js";

/**
    @param {NS} ns
    @param {Number} port
**/
async function version(ns, port) {
    if (port !== undefined && port) {
        const data = ns.sprintf("%d|%s|%s", Date.now(), Module, Version);
        return ns.tryWritePort(port, data);
    }
    ns.tprintf("version %s", Version);
    return;
}

function help(ns) {
    ns.tprintf("usage: %s --version [--update-port] | --help", Module);
    ns.tprintf("this module is a library, import {some} from '%s'", Module); // in case of a library
    return;
}


export class BotNet {
    constructor(ns) {
        this.ns = ns;
        this.workerScript = Constants.workerScriptFile;
        this.workerRam    = ns.getScriptRam(this.workerScript);
        this.update();
    }
    update() {
        const ns = this.ns;
        this.maxRam = 0;
        this.usedRam = 0;
        this.servers =
            serversList(ns)
                .filter(server => !server.name.match(/^(ctrl-server|hack-server|hack-server-0)$/)) // do not use ctr-server and hack-server for workers
                .filter(server => ns.hasRootAccess(server.name))
                .filter(server => ns.getServerMaxRam(server.name) > this.workerRam)
                .filter(server => ns.fileExists(this.workerScript, server.name));
        this.servers
            .forEach(server => {
                server.maxRam  = ns.getServerMaxRam(server.name);
                server.usedRam = ns.getServerUsedRam(server.name);
                server.workers = Math.floor((server.maxRam - server.usedRam)/this.workerRam);
                this.maxRam += server.maxRam;
                this.usedRam += ns.getServerUsedRam(server.name);
            });
        this.maxWorkers = Math.floor(this.maxRam/this.workerRam);
        this.workers = Math.floor((this.maxRam - this.usedRam - Constants.reserveRam)/this.workerRam);
    }
}

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
    help();
    return;
}
