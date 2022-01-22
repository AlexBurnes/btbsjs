// target.js
// version 0.1.0

/*
    based on  https://github.com/Baizey/BitBurner.git  version 1.2.0 target.js
*/

export class Target {

    /**
     * @param {import("Ns").NS } ns
     * @param {string} name
     * @param {string} host
     */
    constructor(logger, name, host = undefined) {
        this.ns = logger.ns;
        this.lg = logger;
        this.name = name;
        this.host = host || ns.getHostname();
        this.ns.print(`Host: ${this.host}, Target: ${this.name}`);
    }

 
    /**function 
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
    execute(cmd, threads, options = {}) {
        const start = options.start || Date.now();
        const pid = this.ns.exec('worker.js', this.host, threads, this.name, cmd, start, this.host, threads, options.await);
        if (!options.await) return Promise.resolve();

        //this.lg.log("[%s:%d] work start '%s' job '%s' threads %d", this.host, pid, this.name, cmd, threads);
        const end = new Date(start + options.await);
        const begin = Date.now();
        return new Promise(async resolve => {
            while (this.ns.isRunning('worker.js', this.host, this.name, cmd, start)) {
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
                //await this.lg.log("[%s:%d] work done for '%s' job '%s' in %s", this.host, pid, this.name, cmd, timeout.toUTCString().substr(17, 8));
            }
            resolve();
        })
    }	
}