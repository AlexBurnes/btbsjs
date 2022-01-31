const Module  = '/h3ml/bin/server-rm.js';
const Version = '0.3.2.29'; // update this every time when edit the code!!!

import {Constants}  from "/h3ml/lib/constants.js";
import {Logger}     from "/h3ml/lib/log.js";

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
    ns.tprintf("usage: %s NAME | --version [--update-port] | --help", Module);
    ns.tprintf("delete server of NAME");
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

    const [name] = args["_"];

    const servers = ns.getPurchasedServers();
    if (servers.filter(s => s == name).length) {

    const promptText = ns.vsprintf("delete server '%s' size of %dGb?", [name, ns.getServerMaxRam(name)]);
    if (await ns.prompt(promptText)) {
        if (ns.deleteServer(name)) {
        l.r("ok server '%s' removed", name);
        }
        else {
        l.e("failed to delete server '%s'", name);
        }
    }
    else {
        l.e("user cancel delete server %s", name);
    }
    return;
    }

    l.e("threre is no server with this name %s", name);
    return;
}

/**
 * @param {{servers: any[]}} data
 * @param {any[]} args
 * @returns {*[]}
 */
export function autocomplete(data, args) {
    return [...data.servers];
}
