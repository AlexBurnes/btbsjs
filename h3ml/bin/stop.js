// stop.js
// version 0.1.0

/*
    stop watcher.js at home
*/

/** @param {NS} ns **/
export async function main(ns) {
    ns.kill("watcher.js", ns.getHostname());
}