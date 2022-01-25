// weak.js
// version 0.1.10

import {Target} from "lib-target.js"
import {Logger} from "log.js"
import {serversList} from "lib-server-list.js"

/**
 * @param {Ns} ns
 * @returns void
 */
export async function main(ns) {
    let [name, threads] = ns.args;
    const lg = new Logger(ns);
    if (name == undefined || typeof(name) !== 'string') {
        lg.log("usage: run weak.js name [threads] [host]");
        return;
    }
    if (!ns.hasRootAccess(name)) {
        lg.log("'%s' no root access", name);
        return;
    }
    if (threads == undefined) {
        ns.tprintf("usage: run grow.js name threads [host]");
    }
    if (typeof(threads) !== "number") {
        lg.log("usage: run weak.js name [threads] [host]")
        return;
    }

    const hosts = serversList(ns).filter(server => ns.hasRootAccess(server.name) && ns.getServerMaxRam(server.name) > 0);
    lg.log(1, "run weak threads %d on %d servers", threads, hosts.length);

    const target = new Target(lg, name, hosts);
    await target.weaken(threads, {await: true});
}

export function autocomplete(data, args) {
    return [...data.servers];
}
