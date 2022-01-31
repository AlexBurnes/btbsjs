const Module  = '/h3ml/bin/weak.js';
const Version = '0.3.2.27'; // update this every time when edit the code!!!

import {Constants}  from "/h3ml/lib/constants.js";
import {Logger}     from "/h3ml/lib/log.js";
import {Servers}    from "/h3ml/lib/server-list.js";

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
    ns.tprintf("usage: %s target threads | --version [--update-port] | --help", Module);
    ns.tprintf("weak target with threads");
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

    let [name, threads, host] = ns.args;
    if (name == undefined || typeof(name) !== 'string') {
        l.e("target name is undefined or wrong");
        return help(ns);
    }
    if (!ns.hasRootAccess(name)) {
        l.e("'%s' no root access", name);
        return;
    }
    if (threads == undefined) {
        l.e("number of threads is undefined")
        return help(ns);
    }
    if (typeof(threads) !== "number") {
        l.e("threads is not a number")
        return help(ns);
    }

    // FIXME and has worker script!
    // FIXME calulate max threads here or type error

    const hosts = Servers.list(ns)
        .filter(server =>
            ns.hasRootAccess(server.name) && ns.getServerMaxRam(server.name) > 0
        );

    l.g(1, "run weaken threads %d on %d servers", threads, hosts.length);

    const target = new Target(l, name, hosts);
    await target["weak"](threads, {await: true});
}

export function autocomplete(data, args) {
    return [...data.servers];
}
