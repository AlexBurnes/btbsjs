const Module  = '/h3ml/lib/target-speed.js';
const Version = '0.3.6.1'; // update this every time when edit the code!!!

import {Server}      from "/h3ml/lib/server-min.js";

export class Target extends Server {
    /**
     * @param {import("Ns").NS } ns
     * @param {string} name
     * @param {Array{server}} hosts
     */
    constructor(l, name, hosts) {
        super(l.ns, name);
        this.l = l;
        this.hosts = hosts;
        this.workerScript = "/h3ml/sbin/worker-min.js";
        this.workerRam = l.ns.getScriptRam(this.workerScript);

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
            await: options.await, end: this.ns.getHackTime(this.name)
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
            await: options.await, end: this.ns.getWeakenTime(this.name)
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
            await: options.await, end: this.ns.getGrowTime(this.name)
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

        //FIXME need to provide Server class with method maxRam, usedRam
        this.hosts.sort(function(a, b){
            return (ns.getServerMaxRam(b.name) - ns.getServerUsedRam(b.name)) -
                (ns.getServerMaxRam(a.name) - ns.getServerUsedRam(a.name))
        });
        let scripts = [];
        this.hosts
            .forEach(server => {
                if (threads > 0) {
                    const serverMaxRam = ns.getServerMaxRam(server.name);
                    const serverUsedRam = ns.getServerUsedRam(server.name);
                    const hostThreads = (serverMaxRam - serverUsedRam) / this.workerRam;
                    if (hostThreads > 0) {
                        server.workerThreads = Math.min(hostThreads, threads);
                        const pid = ns.exec(this.workerScript, server.name, server.workerThreads,
                            this.name, cmd, start, server.name, server.workerThreads, options.end, options.batch
                        );
                        server.workerPid = pid;
                        scripts.push(server);
                        threads -= server.workerThreads;
                    }

                }
            });

        if (!options.await) return Promise.resolve();

        const end = new Date(start + options.await);
        const begin = Date.now();

        return new Promise(async resolve => {
            while (scripts.length) {
                scripts =
                    scripts
                        .filter(server => this.ns.isRunning(this.workerScript, server.name,
                            this.name, cmd, start, server.name, server.workerThreads, options.end, options.batch
                        ));
                if (end.getTime() > Date.now()) {
                    const now = new Date(end.getTime() - Date.now());
                    if (now.getUTCHours()) await this.ns.sleep(1000 * 60 * 60)
                    else if (now.getUTCMinutes() > 10) await this.ns.sleep(1000 * 60 * 10)
                    else if (now.getUTCMinutes()) await this.ns.sleep(1000 * 60)
                    else if (now.getUTCSeconds() > 10) await this.ns.sleep(1000 * 10)
                    else if (now.getUTCSeconds() > 1) await this.ns.sleep(1000)
                    else await this.ns.sleep(100)
                }
                else await this.ns.sleep(100)
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
    ns.tprintf("module %s version %s", Module, Version);
    return;
}

function help(ns) {
    ns.tprintf("usage: %s --version [--update-port] | --help", Module);
    ns.tprintf("this module is a library, import {some} from '%s'", Module);
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
