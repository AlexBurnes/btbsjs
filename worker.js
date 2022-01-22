// worker.js
// version 0.1.0

const protocolVersion = 1;

/**
 * @param {import("Ns").NS } ns
 * @returns {void}
 */
export async function main(ns) {
    const [target, method, time, host, threads, end] = ns.args;

    if (time) await ns.sleep(time - Date.now());
    const hostName = host == undefined ? "" : host;
    const threadsNum = threads == undefined ? 0 : threads;
    const eventTime = Date.now();
    await ns.tryWritePort(1, ns.sprintf("%d|%d|>|%s|%d|%s|%s|%d", eventTime, protocolVersion, hostName, threadsNum, target, method, end));
    const result = await ns[method](`${target}`);
    await ns.tryWritePort(1, ns.sprintf("%d|%d|<|%s|%d|%d|%s|%s|%f", Date.now(), protocolVersion, hostName, threadsNum, eventTime, target, method, result));
}

/** @param {import("Ns").NS } ns */
async function staticMemory(ns) {
    await ns.grow('');
}