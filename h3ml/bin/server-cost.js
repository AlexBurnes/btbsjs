const Module  = '/h3ml/bin/server-cost.js';
const Version = '0.3.5.4'; // update this every time when edit the code!!!

import {Constants}  from "/h3ml/lib/constants.js";
import {Logger}     from "/h3ml/lib/log.js";
import {Units}      from "/h3ml/lib/units.js";
import {Table}      from "/h3ml/lib/utils.js"

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


    const [requestSizeGb] = args["_"];

    const minSizeGb = typeof (requestSizeGb) === 'number' ? requestSizeGb : 1;
    const maxSizeGb = typeof (requestSizeGb) === 'number' ? requestSizeGb : Constants.uGb;

    const table = new Table(ns, [
        ["Size",    "%d%s"],
        //["2^n",     "2^%d"],
        //["Size Gb", "%d"],
        ["Price",   "%0.2f%s"]
    ]);

    let i = 0;
    for(let sizeGb=minSizeGb; sizeGb <= maxSizeGb; sizeGb*=2) {
        const costFmt = Units.money(ns.getPurchasedServerCost(sizeGb));
        const sizeFmt = Units.size(sizeGb * Constants.uGb);
        table.push(
            [sizeFmt.size, sizeFmt.unit],
            //i++,
            //sizeGb,
            [costFmt.amount, costFmt.unit]
        );
    }
    ns.disableLog("ALL");
    ns.print(table.print());
    ns.tail(Module);
}
