const Module  = '/h3ml/bin/share.js';
const Version = '0.3.4.1'; // update this every time when edit the code!!!

import {Constants}   from "/h3ml/lib/constants.js";
import {Logger}      from "/h3ml/lib/log.js";
import {Servers}     from "/h3ml/lib/server-list.js";
import {ScriptFiles} from "/h3ml/etc/scripts.js";

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

    const servers = Servers.list(ns).filter(server => server.name.match(/^share-server-/));
    let totalThreads = 0;
    const powerBefore = ns.getSharePower();

    for(let i = 0; i < servers.length; i++) {
        const server = servers[i];
        l.d(1, "check server %s", server.name);
        if (!ns.fileExists(Constants.shareScriptFile, server.name)) {
            l.d(1, "copy %s to server %s", Constants.shareScriptFile, server.name);
            await ns.scp(Constants.shareScriptFile, server.name);
        }
        const threads = Math.floor((ns.getServerMaxRam(server.name) - ns.getServerUsedRam(server.name)) / ScriptFile[Constants.shareScriptFile]);
        l.d(1, "could run on %s %d threads", server.name, threads);
        if (threads > 0) {
            pid = ns.exec(Constants.shareScriptFile, server.name, threads);
            if (pid) totalThreads += threads;
        }
    }

    const powerAfter = ns.getSharePower();
    if (totalThreads > 0) {
        l.d("run more %d threads, power before %f, after %f, grow %f, grow one thread %f",
            totalThreads, powerBefore, powerAfter, powerAfter/powerBefore,  (powerAfter-powerBefore)/totalThreads
        );
    }
    l.r(`Share power ${powerAfter}`);
}
