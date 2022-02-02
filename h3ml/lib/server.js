const Module  = '/h3ml/lib/server.js';
const Version = '0.3.3.16';     // update this every time when edit the code!!!

import {Units} from "/h3ml/lib/units.js";

export class Server {
    constructor(ns, name) {
        this.ns   = ns;
        this.name = name;
    }
    get maxRam()        {return ns.getServerMaxRam(this.name);}
    get usedRam()       {return ns.getServerUsedRam(this.name);}
    get maxMoney()      {return Units.money(ns.getServerMaxMoney(this.name));}
    get minSecurity()   {return ns.getServerMinSecurityLevel(this.name);}
    get curSecurity()   {return ns.getServerSecurityLevel(this.name);}
    get hackLevel()     {return ns.getServerRequiredHackingLevel(this.name);}

    get faction() {
            return
                ns.getServerMaxRam(server.name) >= 0 &&
                ns.getServerMaxMoney(server.name) == 0 &&
                ns.getServerRequiredHackingLevel(server.name) > 1
                ? true
                : false;
            }

    get purshaced() {
            return
                ns.getServerMaxRam(server.name) > 0 &&
                ns.getServerMaxMoney(server.name) == 0 &&
                ns.getServerRequiredHackingLevel(server.name) == 1
                ? true
                : false;
            }
}

/**
    @param {NS} ns
    @param {Number} port
**/
async function version(ns, port) {
    if (port !== undefined && port) {
        const data = ns.sprintf("%d|%s|%s", Date.now(), Module, Version);
        return ns.tryWritePort(port, data);
    }
    ns.tprintf("version %s", Version);
    return;
}

function help(ns) {
    ns.tprintf("usage: %s --version [--update-port] | --help", Module);
    ns.tprintf("this module is a library, import {Server} from '%s'", Module); // in case of a library
    return;
}

/** @param {NS} ns **/
export async function main(ns) {
    const args = ns.flags([
        [ 'version'     , false ],
        [ 'update-port' , 0     ],
        [ 'help'        , false ]
    ]);

    if (args['version']) {
        return version(ns, args['update-port']);
    }
    if (args['help']) {
        return help(ns);
    }
    help(ns);
    return;
}

