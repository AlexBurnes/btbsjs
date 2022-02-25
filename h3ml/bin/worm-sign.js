const Module  = '/h3ml/bin/worm-sing.js';
const Version = '0.3.6.35'; // update this every time when edit the code!!!

import {Constants}      from "/h3ml/lib/constants.js";
import {Logger}         from "/h3ml/lib/log.js";
import {Servers}        from "/h3ml/lib/server-list.js";

async function version(ns, port) {
    if (port !== undefined && port) {
        const data = ns.sprintf("%d|%s|%s", Date.now(), Module, Version);
        return ns.tryWritePort(port, data);
    }
    ns.tprintf("module %s version %s", Module, Version);
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


    const dest = args["_"][1] || args["_"][0] || "*";
    const source = args["_"][1] !== undefined ? args["_"][0]||"home" : "home";

    l.d(1, "source '%s' dest '%s'", source, dest);

    const re = new RegExp(dest == "*" ? ".*" : `^${dest}\$`);

    const servers = Servers.list(ns)
        .filter(server => (server.name != "home" && dest != "home") || dest == "home")
        .filter(server => !server.name.match(/^(?:devel-|share-)/) || dest == server.name)
        .filter(server => server.name.match(re));

    l.d(1, "copy files from %s to %s", source, servers.map(server => server.name).join(', '));

    const server_files = ns.ls(source)
        .filter(f => f.match(/^.*\.js$/));

    const target_files = ns.ls(source)
        .filter(f => f.match(/worker(\-[^\.]+)?.js|constants.js|network.js|log.js|quiet.js|verbose.js|h3ml-settings.js/));

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

    l.g(1, "user hack level %d", ns.getHackingLevel());
    for (const server of servers) {
        l.d(1, "server '%s' root access %s, backdoor %s hack level %d", server.name, ns.hasRootAccess(server.name) == true ? "yes" : "no",
            ns.getServer(server.name).backdoorInstalled == true ? "yes" : "no", ns.getServerRequiredHackingLevel(server.name)
        );
        if (ns.hasRootAccess(server.name)) {
            const files = server.name.match(/^[a-zA-Z0-9]+?[\_\-]server(?:[\_\-]\d+)*$/) || server.name == "home"
                ? server_files
                : target_files;
            l.d(1, "copy files %s => %s: %s", source, server.name, files.join(","))
            await tryCatchIgnore(async () => await ns.scp(files, source, server.name));
            if (!ns.getServer(server.name).backdoorInstalled && ns.getServerRequiredHackingLevel(server.name) <= ns.getHackingLevel()) {
                l.g(1, "install backdoor '%s'", server.name);
                await tryCatchIgnore(async () => await backdoor(l, server.name));
            }
        }
    }
    ns.tprintf("worm done");
}

async function backdoor(l, host) {
    const ns = l.ns
    const paths = {'home': []};
    const queue = Object.keys(paths);

    while (queue.length > 0) {
        const current = queue.shift();
        ns.scan(current)
            .filter(e => !paths[e])
            .forEach(server => {
                queue.push(server);
                paths[server] = paths[current].concat([server])
            })
    }

    if (!paths[host]) {
        l.e("No path found to node %s", host);
        return;
    }

    for(let i = 0; i < paths[host].length; i++) {
        await ns.connect(paths[host][i]);
    }
    await ns.installBackdoor();
    await ns.connect('home');
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
        //ignore
    }
}
