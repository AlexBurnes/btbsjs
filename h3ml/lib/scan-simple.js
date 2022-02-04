const Module  = '/h3ml/lib/scan-simple.js';
const Version = '0.3.3.8'; // update this every time when edit the code!!!

import {Constants}  from "/h3ml/lib/constants.js";
import {Logger}     from "/h3ml/lib/log.js"
import {Servers}    from "/h3ml/lib/server-list.js"

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
    ns.tprintf("scan servers and output as tree, output name only");
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


    Servers.tree(ns, (pad, server) => {
        ns.tprintf("%s %s%s [%d] %dGb %.2f%s$",
            pad, server.faction ? "☮ " : server.purshaced ? "⚒ " : "", server.name,
            server.hackLevel, server.maxRam, server.maxMoney.amount, server.maxMoney.unit
        );
    });
}
