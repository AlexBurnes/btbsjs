// vernose.js
// version 0.1.10
// set watcher verbose

/** @param {NS} ns **/
const protocolVersion = 2;
const ctrlPort = 1;

export async function main(ns) {
    await ns.tryWritePort(ctrlPort, ns.sprintf("%d|%d|@|0|verbose", Date.now(), protocolVersion));
}
