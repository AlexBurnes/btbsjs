/**
 * @param {Ns} ns
 * @returns void
 */
import {Target} from "target.js"
import {Logger} from "log.js"

export async function main(ns) {
    let [name, threads, host] = ns.args;
    const lg = new Logger(ns);
    if (name == undefined || typeof(name) !== 'string') {
        ns.tprintf("usage: run hack.js name [threads] [host]");
        return;
    }
    if (!ns.hasRootAccess(name)) {
        ns.tprintf("'%s' no root access", name);
        return;
    }
    if (host == undefined) host = ns.getHostname();
    if (!ns.hasRootAccess(host)) {
        ns.tprintf("'%s' no root access", host);
        return;
    }
    if (threads == undefined) threads = 0;
    else if (typeof(threads) !== "number") {
        ns.tprintf("usage: run hack.js name [threads] [host]")
        return;
    }
    const target = new Target(lg, name, host);
    await target.grow(threads, {await: true});
}

export function autocomplete(data, args) {
    return [...data.servers];
}
