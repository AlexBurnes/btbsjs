// worm.js
// version 0.1.0

/*
    based https://github.com/Baizey/BitBurner.git  version 1.2.0 worm.js
    very simple and effective script
*/

import {serversList} from "lib-server-list.js";

/** @param {import("Ns").NS } ns */
export async function main(ns) {
    const servers = serversList(ns)
        .filter(server => server.name !== "home");

    const files = ns.ls(ns.getHostname())
        .filter(f => f.match(/^.*\.js$/));

    for (let server of servers.map(e => e.name)) {
        if (!ns.hasRootAccess(server)) {
            await tryCatchIgnore(() => ns.brutessh(server))
            await tryCatchIgnore(() => ns.relaysmtp(server))
            await tryCatchIgnore(() => ns.httpworm(server))
            await tryCatchIgnore(() => ns.ftpcrack(server))
            await tryCatchIgnore(() => ns.sqlinject(server))
            await tryCatchIgnore(() => ns.nuke(server))
        }
    }

    for (const server of servers) {
        if (ns.hasRootAccess(server.name)) {
            await tryCatchIgnore(async () => await ns.scp(["worker.js", "backdoor.js"], ns.getHostname(), server.name));
            // Needs singularity :/
            //await tryCatchIgnore(() => ns.exec('backdoor.js', server.name));
        }
    }
    ns.tprintf("worm done");
}

/**
 * @param {(() => Promise<void>) | (() => void)} lambda
 * @returns {Promise<void>}
 */
async function tryCatchIgnore(lambda) {
    try {
        await lambda();
    } catch (e) {
        // ignore
    }
}
