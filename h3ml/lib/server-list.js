const Module  = '/h3ml/lib/server-list.js';
const Version = '0.3.2.23';     // update this every time when edit the code!!!

import {Constants}  from "/h3ml/lib/constants.js";
import {LVS}        from "/h3ml/lib/utils.js";

export class Server {
    constructor(name) {
        this.name = name;
    }
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
    * @param {import("Ns").NS } ns
    * @returns {Server[]} depth is 1-indexed
    */
    list(ns) {
        const list = [];
        const visited = {"home": 1};
        const queue = Object.keys(visited);
        while (queue.length > 0) {
            const host = queue.pop();
            const current = new Server(host);
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
    * @param {({String}, {Node} [, {LVS}]) =>{}} lambda
    * @returns {void}, this function build and walk tree call lambda for each node
    */
    tree(ns, lambda) {
        const root = new Node('home', 0);
        const visited = {'home': root};
        const queue = Object.keys(visited);
        while (queue.length > 0) {
            const host = queue.pop();
            const node = visited[host];
            ns.scan(host)
                .filter(e => !visited[e])
                .forEach(child => {
                    const server = new Node(child, node.depth+1);
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
        lvs = new LVS();
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

