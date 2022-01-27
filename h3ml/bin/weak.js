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
        l.g("usage: run weak.js name [threads] [host]");
        return;
    }
    if (!ns.hasRootAccess(name)) {
        l.g("'%s' no root access", name);
        return;
    }
    if (threads == undefined) {
        ns.tprintf("usage: run grow.js name threads [host]");
    }
    if (typeof(threads) !== "number") {
        l.g("usage: run weak.js name [threads] [host]")
        return;
    }

    const hosts = serversList(ns).filter(server => ns.hasRootAccess(server.name) && ns.getServerMaxRam(server.name) > 0);
    l.g(1, "run weak threads %d on %d servers", threads, hosts.length);

    const target = new Target(lg, name, hosts);
    await target.weaken(threads, {await: true});
}

export function autocomplete(data, args) {
    return [...data.servers];
}
