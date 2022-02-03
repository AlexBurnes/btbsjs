const Module  = '/h3ml/lib/server-min.js';
const Version = '0.3.4.11';     // update this every time when edit the code!!!

import {Units}       from "/h3ml/lib/units.js";
import {serversData} from "/h3ml/etc/servers.js";

export class Server {
    constructor(ns, name, depth, childs) {
        this.ns     = ns;
        this.name   = name;
        this.depth  = depth;
        this.childs = childs;
        this.data   = serversData[name];
        // avoid undefined value
        if (data == undefined) {
            data = {
                maxRam: 0,
                maxMoney: 0,
                minSecurity: 0,
                hackDifficulty: 1,
                factionServer: false,
                purshacedServer: false
            }
        }
    }

    get maxRam()            {return this.data.maxRam;}
    get usedRam()           {return this.ns.getServerUsedRam(this.name);}
    get maxMoney()          {return Units.money(this.data.maxMoney);}
    get minSecurity()       {return this.data.minSecurity;}
    get currentSecurity()   {return this.ns.getServerSecurityLevel(this.name);}
    get hackLevel()         {return this.data.hackDifficulty;}
    get faction()           {return this.data.factionServer;}
    get purshaced()         {return this.data.purshacedServer;}
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

