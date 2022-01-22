// weaken.js
// version 0.1.0

import {Target} from "target.js"
import {Logger} from "log.js"

/**
 * @param {Ns} ns
 * @returns void
 */
export async function main(ns) {
    let [name, threads, host] = ns.args;
    const lg = new Logger(ns);
    if (name == undefined || typeof(name) !== 'string') {
        lg.log("usage: run weak.js name [threads] [host]");
        return;
    }
    if (!ns.hasRootAccess(name)) {
        lg.log("'%s' no root access", name);
        return;
    }
    if (host == undefined) host = ns.getHostname();
    if (!ns.hasRootAccess(host)) {
        lg.log("'%s' no root access", host);
        return;
    }
    if (threads == undefined) threads = 0;
    else if (typeof(threads) !== "number") {
        lg.log("usage: run weak.js name [threads] [host]")
        return;
    }
    const target = new Target(lg, name, host);
    await target.weaken(threads, {await: true});
}

export function autocomplete(data, args) {
    return [...data.servers];
}
