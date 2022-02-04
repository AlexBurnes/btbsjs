const Module  = '/h3ml/bin/server-buy-min.js';
const Version = '0.3.4.18'; // update this every time when edit the code!!!

import {Logger}     from "/h3ml/lib/log.js";

//FIXME move to constants
const UnitGb = Math.pow(2, 30);

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
    ns.tprintf("usage: %s NAME SIZE | --version [--update-port] | --help", Module);
    ns.tprintf("buy server NAME with memory SIZE in gb");
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
        [ 'quiet'       , false ] // quiet mode, short analog of --log-level 0

    ]);

    if (args['version']) {
        return version(ns, args['update-port']);
    }
    if (args['help']) {
        return help(ns);
    }

    // for modules
    const l = new Logger(ns, {args: args});


    const [name, requestSizeGb] = args["_"];

    if (name == undefined || requestSizeGb == undefined) {
        l.e("name and/or size is undefined");
        help(ns);
        return;
    }

    let [_, size, unit] = requestSizeGb.match(/^(\d+)(g|t|G|T|p|P)+/);
    if (unit !== undefined) {
        switch (unit) {
            case 'G':
            case 'g':
                break;
            case 'T':
            case 't':
                size *= 1024;
                break;
            case 'P':
            case 'p':
                size *= 1024*1024;
        }
    }

    l.g(1, "request server size %s => %dG", requestSizeGb, size);

    const server_name = ns.purchaseServer(name, size);

    if (server_name !== "") {
        l.r("ok new server %s", server_name);
    }
    else {
        l.e("failed to buy server");
    }
}
