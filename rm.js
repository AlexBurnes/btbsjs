// rm.js
// version 0.1.6

/*
    rm files by filter pattern
*/

import {Logger} from "log.js"

/** @param {NS} ns **/
/** @param {String} filter */
/** @param {String} host */

export async function main(ns) {
    const [filter, host = ns.getHostname()] = ns.args;
    const lg = new Logger(ns);

    if (filter == undefined) {
        l.g(1, "usage: rm pattern [host]");
        return;
    }

    const re = new RegExp(filter);

    ns.ls(host)
        .filter(file => file.match(re))
        .forEach(file => {
            ns.rm(file, host);
            if (ns.fileExists(file, host)) {
                l.g(1, "failed rm %s", file);
            }
            else {
                l.g(1, "rm %s", file);
            }
        });
}
