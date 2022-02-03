const Module  = '/h3ml/bin/worm.js';
const Version = '0.3.3.8'; // update this every time when edit the code!!!

import {Constants}      from "/h3ml/lib/constants.js";
import {Logger}         from "/h3ml/lib/log.js";
import {Servers}        from "/h3ml/lib/server-list.js";

async function version(ns, port) {
    if (port !== undefined && port) {
        const data = ns.sprintf("%d|%s|%s", Date.now(), Module, Version);
        return ns.tryWritePort(port, data);
    }
    ns.tprintf("version %s", Version);
    return;
}

/**
    @param {NS} ns
    @param {Number} port
**/
function help(ns) {
    ns.tprintf("usage: %s --version [--update-port] | --help", Module);
    ns.tprintf("copy scripts to hack servers, copy worker scrtipts to target servers");
    return;
}

/** @param {NS} ns **/
export async function main(ns) {
    const args = ns.flags([
        [ 'version'     , false ],
        [ 'update-port' , 0     ],
        [ 'help'        , false ],
        [ 'log'         , 1     ], // log level - 0 quiet, 1 and more verbose
        [ 'debug'       , 0     ], // debug level
        [ 'verbose'     , true  ], // verbose mode, short analog of --log-level 1
        [ 'quiet'       , false ]  // quiet mode, short analog of --log-level 0

    ]);

    if (args['version']) {
        return version(ns, args['update-port']);
    }
    if (args['help']) {
        return help(ns);
    }

    // for modules
    const l = new Logger(ns, {args: args});
    l.g(1, "%s %s", Module, Version);

    const dest = args["_"][1] || args["_"][0];
    const source = args["_"][1] !== undefined ? args["_"][0]||"home" : "home";

    // do not copy anything to devel servers from home only if defined source

    const servers = Servers.list(ns)
        .filter(server => server.name != "home")
        .filter(server =>
            (source == "home" && !server.name.match(/^(?:devel-|share-)/)) ||
            ((dest !== undefined && server.name == dest) || (dest == undefined))
        );

    l.d(1, "copy files from %s to %s", source, servers.map(server => server.name).join(', '));

    const server_files = ns.ls(source)
        .filter(f => f.match(/^.*\.js$/));

    const target_files = ns.ls(source)
        .filter(f => f.match(/worker.js|constants.js|network.js|log.js|quiet.js|verbose.js/));

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
            const files = server.name.match(/^[a-zA-Z0-9]+\[\_\-]server(?:[\_\-]\d+)*$/)
                ? server_files
                : target_files;
            await tryCatchIgnore(async () => await ns.scp(files, ns.getHostname(), server.name));
            // Needs singularity :/
            //await tryCatchIgnore(() => ns.exec('backdoor.js', server.name));
        }
    }
    ns.tprintf("worm done");
}

export function autocomplete(data, args) {
    return [...data.servers];
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
