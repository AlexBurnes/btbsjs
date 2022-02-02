const Module  = '/h3ml/bin/server-cost.js';
const Version = '0.3.3.16'; // update this every time when edit the code!!!

import {Constants}  from "/h3ml/lib/constants.js";
import {Logger}     from "/h3ml/lib/log.js";
import {Units}      from "/h3ml/lib/units.js";

//FIXME move to constants
const UnitGb = Math.pow(2, 30);

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
    ns.tprintf("usage: %s [SIZE] | --version [--update-port] | --help", Module);
    ns.tprintf("output servers prices, if SIZE is defined only price of this memot size server ");
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

    const [requestSizeGb] = args["_"];

    const minSizeGb = typeof (requestSizeGb) === 'number' ? requestSizeGb : 1;
    const maxSizeGb = typeof (requestSizeGb) === 'number' ? requestSizeGb : Math.pow(2, 20);
    let i = 0;
    for(let sizeGb=minSizeGb; sizeGb <= maxSizeGb; sizeGb*=2) {
        const costFmt = Units.money(ns.getPurchasedServerCost(sizeGb));
        const sizeFmt = Units.size(sizeGb * UnitGb);
        l.g("\t%d%s (2^%d %dG) cost %0.2f%s",
            sizeFmt.size, sizeFmt.unit, i++, sizeGb, costFmt.amount, costFmt.unit
        );
    }
}
