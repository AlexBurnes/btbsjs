const Module  = '/h3ml/lib/server-list.js';
const Version = '0.3.3.22';     // update this every time when edit the code!!!

import {Constants}   from "/h3ml/lib/constants.js";
import {Lvs}         from "/h3ml/lib/utils.js";
import {Units}       from "/h3ml/lib/units.js";
import {serversData} from "/h3ml/etc/servers.js"

// extra mininimal implementation of Server class
export class Server {
    constructor(ns, name, depth, childs) {
        this.ns     = ns;
        this.name   = name;
        this.depth  = depth;
        this.childs = childs;
        this.data = serversData[name] || {
            maxRam: 0,
            maxMoney: 0,
            minSecurity: 0,
            hackDifficulty: 1,
            factionServer: false,
            purshacedServer: false
        };
    }
    get maxRam()        {return this.data.maxRam;}
    get usedRam()       {return 0;}
    get maxMoney()      {return Units.money(this.data.maxMoney);}
    get minSecurity()   {return this.data.minSecutiry;}
    get curSecurity()   {return 0;}
    get hackLevel()     {return this.data.hackDifficulty;}
    get faction()       {return this.data.factionServer;}
    get purshaced()     {return this.data.purshacedServer;}
}

class Node {
    constructor(name, depth) {
        this.name   = name;
        this.depth  = depth;
        this.childs = [];
    }
}

class _Servers {
    constructor() {
        if (!_Servers._instance) {
            _Servers._instance = this
        }
        return _Servers._instansce;
    }
    /**
    * @param {import("Ns").NS} ns
    * @param {import("Server").Server} server
    * @returns {Server[]} depth is 1-indexed
    */
    list(ns, server_ctor = Server) {
        const list = [];
        const visited = {"home": 1};
        const queue = Object.keys(visited);
        while (queue.length > 0) {
            const host = queue.pop();
            const current = new server_ctor(ns, host);
            list.push(current);
            ns.scan(current.name)
                .reverse()
                .filter(e => !visited[e])
                .forEach(server => {
                    queue.push(server);
                    visited[server] = visited[host] + 1;
                });
        }
        return list;
    }

    /**
    * @param {import("Ns").NS } ns
    * @param {({String}, {Node} [, {Lvs}]) =>{}} lambda
    * @returns {void}, this function build and walk tree call lambda for each node
    */
    tree(ns, lambda, server_ctor = Server) {
        const root = new Node(ns, 'home', 0, []);
        const visited = {'home': root};
        const queue = Object.keys(visited);
        while (queue.length > 0) {
            const host = queue.pop();
            const node = visited[host];
            ns.scan(host)
                .filter(e => !visited[e])
                .forEach(child => {
                    const server = new server_ctor(ns, child, node.depth+1, []);
                    queue.push(server.name);
                    node.childs.push(server);
                    visited[server.name] = server;
                });
        }
        if (lambda !== undefined) {
            treeWalk(root, lambda);
        }
        return root;
    }
    host(name) {
        return new Host(name);
    }
}

export const Servers = new _Servers();

function treeWalk(node, lambda, lvs) {
    if (lvs == undefined) {
        lvs = new Lvs();
        lambda(lvs.empty, node, lvs);
    }
    for(let i=0; i < node.childs.length; i++) {
        const child = node.childs[i];
        lambda(lvs.pad(child.depth, i == node.childs.length-1 ? 1 : 0), child, lvs)
        treeWalk(child, lambda, lvs);
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
    ns.tprintf("this module is a library, import {some} from '%s'", Module); // in case of a library
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

