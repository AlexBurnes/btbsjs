const Module  = '/h3ml/lib/target.js';
const Version = '0.3.3.16'; // update this every time when edit the code!!!

import {Constants}  from "/h3ml/lib/constants.js";
import {Server}     from "/h3ml/lib/server.js";

export class Target extends Server {
    /**
     * @param {import("Ns").NS } ns
     * @param {string} name
     * @param {Array{server}} hosts
     */
    constructor(l, name, hosts) {
        super(l.ns, name);
        this.l     = l;
        this.hosts = hosts;
    }

    /**
     * @param {number} threads
     * @param {{start?: number, await?: boolean}} options
     * @returns {Promise<void>}
     * @private
     */
    hack(threads, options = {}) {
        return this.execute('hack', threads, {
            ...options,
            await: options.await && this.ns.getHackTime(this.name)
        });
    }

    /**
     * @param {number} threads
     * @param {{start?: number, await?: boolean}} options
     * @returns {Promise<void>}
     * @private
     */
    weaken(threads, options = {}) {
        return this.execute('weaken', threads, {
            ...options,
            await: options.await && this.ns.getWeakenTime(this.name)
        });
    }

    /**
     * @param {number} threads
     * @param {{start?: number, await?: boolean}} options
     * @returns {Promise<void>}
     * @private
     */
    grow(threads, options = {}) {
        return this.execute('grow', threads, {
            ...options,
            await: options.await && this.ns.getGrowTime(this.name)
        });
    }

    /**
     * @param {string} cmd
     * @param {number} threads
     * @param {{start?: number, await?: number}} options
     * @returns {Promise<void>}
     * @private
     */

    kill(options = {}) {
        // foreach hosts check there is a worker on the host, if exists kill
    }

    execute(cmd, threads, options = {}) {
        const ns = this.ns;
        const start = options.start || Date.now();

        if (this.hosts.length == 0) return Promise.resolve(); // FIXME return error

        const scriptRamRequire = ns.getScriptRam(Constants.workerScriptFile);

        // this logic must be implemeted at strategy layer
        // prioritezation for weaken jobs on host with more cpu
        if (cmd == "weaken" || cmd == "grow") {
            this.hosts.sort(function(a, b){
                return Math.pow(ns.getServerMaxRam(b.name) - ns.getServerUsedRam(b.name), ns.getServer(b.name).cpuCores)
                    - Math.pow(ns.getServerMaxRam(a.name) - ns.getServerUsedRam(a.name), ns.getServer(a.name).cpuCores)
            });
        }
        else {
            this.hosts.sort(function(a, b){
                return (ns.getServerMaxRam(b.name) - ns.getServerUsedRam(b.name)) -
                    (ns.getServerMaxRam(a.name) - ns.getServerUsedRam(a.name))
            });
        }
        let scripts = [];
        this.hosts
            .filter(server => ns.hasRootAccess(server.name))
            .filter(server => ns.getServerMaxRam(server.name) > 0)
            .forEach(server => {
                if (threads > 0) {
                    const serverMaxRam = ns.getServerMaxRam(server.name);
                    const serverUsedRam = ns.getServerUsedRam(server.name);
                    const reserveRam = server.name == "home" ? Constants.reserveRam : 0;
                    const cpuCores = ns.getServer(server.name).cpuCores;
                    const hostThreads = (serverMaxRam - serverUsedRam - reserveRam) / scriptRamRequire;
                    //ns.tprintf("server %s %d/%d CPU %d, threads allow %d", server.name, serverMaxRam, serverUsedRam, cpuCores, hostThreads);
                    if (hostThreads > 0) {

                        const weakCpuCoeff = cpuCores > 1 && cmd == "weaken"
                                ? ns.weakenAnalyze(1)/ns.weakenAnalyze(1, cpuCores)
                                : 1;
                        const growCpuCoeff = cpuCores > 1 && cmd == "grow" && options.growRate !== undefined
                                ? ns.growthAnalyze(server.name, options.growRate, cpuCores)/ns.growthAnalyze(server.name, options.growRate)
                                : 1;
                        //ns.tprint(`weakcoeff ${weakCpuCoeff} growcoeff ${growCpuCoeff}`);
                        server.workerThreads = Math.min(hostThreads, Math.ceil(threads*weakCpuCoeff*growCpuCoeff));
                        const pid = ns.exec(Constants.workerScriptFile, server.name, server.workerThreads,
                            this.name, cmd, start, server.name, server.workerThreads, options.await
                        );
                        /*ns.tprintf("server %s target %s cmd %s threads %d cpu %d pid %d",
                            server.name, this.name, cmd, server.workerThreads, cpuCores, pid
                        );*/
                        server.workerPid = pid;
                        scripts.push(server);
                        threads -= Math.floor(server.workerThreads/(weakCpuCoeff*growCpuCoeff));
                    }

                }
            });

        if (!options.await) return Promise.resolve();

        //this.l.g("[%s:%d] work start '%s' job '%s' threads %d", this.host, pid, this.name, cmd, threads);
        const end = new Date(start + options.await);
        const begin = Date.now();

        return new Promise(async resolve => {
            while (scripts.length) {

                // check for each runned hosts there is script, if no than break, else wait
                //this.ns.isRunning('worker.js', this.host, this.name, cmd, start)
                scripts =
                    scripts
                        .filter(server => this.ns.isRunning(Constants.workerScriptFile, server.name, this.name, cmd, start, server.name, server.workerThreads, options.await));

                if (end.getTime() > Date.now()) {
                    const now = new Date(end.getTime() - Date.now());
                    //this.ns.printf("Worker at %s target %s cmd %s done in %s", this.host, this.name, cmd, now.toUTCString().substr(17, 8));
                    if (now.getUTCHours()) await this.ns.sleep(1000 * 60 * 60)
                    else if (now.getUTCMinutes() > 10) await this.ns.sleep(1000 * 60 * 10)
                    else if (now.getUTCMinutes()) await this.ns.sleep(1000 * 60)
                    else if (now.getUTCSeconds() > 10) await this.ns.sleep(1000 * 10)
                    else await this.ns.sleep(1000)
                }
                else await this.ns.sleep(1000)
                //await this.l.g("[%s:%d] work done for '%s' job '%s' in %s", this.host, pid, this.name, cmd, timeout.toUTCString().substr(17, 8));
            }
            resolve();
        })
    }
}

////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////
// update support
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
