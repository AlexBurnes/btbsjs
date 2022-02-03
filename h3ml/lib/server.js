const Module  = '/h3ml/lib/server.js';
const Version = '0.3.4.14';     // update this every time when edit the code!!!

import {Units} from "/h3ml/lib/units.js";

export class Server {
    constructor(ns, name, depth, childs) {
        this.ns     = ns;
        this.name   = name;
        this.depth  = depth;
        this.childs = childs;
    }
    get maxRam()            {return this.ns.getServerMaxRam(this.name);}
    get usedRam()           {return this.ns.getServerUsedRam(this.name);}
    get maxMoney()          {return Units.money(this.ns.getServerMaxMoney(this.name));}
    get minSecurity()       {return this.ns.getServerMinSecurityLevel(this.name);}
    get currentSecurity()   {return this.ns.getServerSecurityLevel(this.name);}
    get hackLevel()         {return this.ns.getServerRequiredHackingLevel(this.name);}

    get faction() {
        if (this.ns.getServerMaxRam(this.name) >= 0 &&
            this.ns.getServerMaxMoney(this.name) == 0 &&
            this.ns.getServerRequiredHackingLevel(this.name) > 1
        ) return true;
        return false;
    }

    get purshaced() {
        if (this.ns.getServerMaxRam(this.name) > 1 &&
            this.ns.getServerMaxMoney(this.name) == 0 &&
            this.ns.getServerRequiredHackingLevel(this.name) == 1
        ) return true;
        return false;
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

