const Module  = '/h3ml/bin/server-buy.js';
const Version = '0.3.2.29'; // update this every time when edit the code!!!

import {Constants}  from "/h3ml/lib/constants.js";
import {Logger}     from "/h3ml/lib/log.js";
import {memoryFormat, moneyFormat}
                        from "/h3ml/lib/units.js";
import {Servers}    from "/h3ml/lib/server-list.js";

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

    const [name, requestSizeGb] = args["_"];

    const maxServers = ns.getPurchasedServerLimit();
    const servers = ns.getPurchasedServers();
    if (servers.filter(s => s == name).length) {
        l.e("already have server this name %s", name);
        return;
    }

    const hosts = Servers.list(ns);
    if (hosts.filter(s => s.name == name).length) {
        l.e("threre is a server with this name %s", name);
        return;
    }

    if (servers.length - 1 < maxServers) {
        l.e("could buy %d more servers", maxServers - (servers.length - 1));
    }
    else {
        l.e("bought maximum servers %d", maxServers);
    }

    const serverPrice = ns.getPurchasedServerCost(requestSizeGb);
    const priceFmt = moneyFormat(serverPrice);

    const promptText = ns.vsprintf("buy server size of %dGb price is %.2f%s?", [requestSizeGb, priceFmt.amount, priceFmt.unit]);
    if (await ns.prompt(promptText)) {
        const server_name = ns.purchaseServer(name, requestSizeGb);
        if (server_name !== "") {
            l.r("ok new server %s", server_name);
        }
        else {
            l.e("failed to buy server");
        }
    }
    else {
        l.w("user cancel buy");
    }
}
