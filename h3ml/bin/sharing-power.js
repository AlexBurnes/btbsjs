const Module  = '/h3ml/bin/sharing-power.js';
const Version = '0.3.3.24'; // update this every time when edit the code!!!

import {Constants}  from "/h3ml/lib/constants.js";
import {Logger}     from "/h3ml/lib/log.js";

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
    ns.tprintf("sharing");
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

    const l = new Logger(ns, {args: args});
    l.g(1, "%s %s", Module, Version);

    import {serversList} from "lib-server-list.js"

    const servers = serversList(ns).filter(server => server.name.match(/^share-server-/));
    let totalThreads = 0;
    const powerBefore = ns.getSharePower();

    for(let i = 0; i < servers.length; i++) {
        const server = servers[i];
        ns.tprintf("check server %s", server.name);
        if (!ns.fileExists("sharing.js", server.name)) {
            ns.tprintf("copy sharing.js to server %s", server.name);
            await ns.scp("sharing.js", server.name);
        }
        const threads = Math.floor((ns.getServerMaxRam(server.name) - ns.getServerUsedRam(server.name)) / ns.getScriptRam("sharing.js"));
        ns.tprintf("could run on %s %d threads", server.name, threads);
        if (threads > 0) {
            pid = ns.exec("sharing.js", server.name, threads);
            if (pid) totalThreads += threads;
        }
    }

    const powerAfter = ns.getSharePower();
    ns.tprintf("run more %d threads, power before %f, after %f, grow %f, grow one thread %f",
        totalThreads, powerBefore, powerAfter, powerAfter/powerBefore,  (powerAfter-powerBefore)/totalThreads
    );
    l.r(`Share power ${powerAfter}`);
}
