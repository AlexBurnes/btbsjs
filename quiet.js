// quiet.js
// version 0.1.10
// set watcher quiet

/** @param {NS} ns **/
const protocolVersion = 2;
const ctrlPort = 1;

export async function main(ns) {
    await ns.tryWritePort(ctrlPort, ns.sprintf("%d|%d|@|0|quiet", Date.now(), protocolVersion));
}
