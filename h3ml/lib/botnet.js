// lib-botnet.js
// version 0.1.10
import {Constants} from "lib-constants.js";
import {Server, serversList} from "lib-server-list.js";

export class BotNet {
    constructor(ns) {
        this.ns = ns;
        this.workerScript = Constants.workerScriptFile;
        this.workerRam = ns.getScriptRam(this.workerScript);
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
