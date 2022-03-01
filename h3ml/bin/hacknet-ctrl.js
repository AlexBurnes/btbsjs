const Module  = '/h3ml/bin/hacknet-ctrl.js';
const Version = '0.3.7.0'; // update this every time when edit the code!!!

/*
    what command need to implement

        hacknet CMD OPTION
            max-nodes N     - set maximum nodes,    -1 unlimited, N
            max-level N
            max-core  N
            max-cache N
            max-ram   N

            upgrade enable|disable [type|all]  - enable or disable upgrade hacknet nodes, default all
            money                              - spend haches for money, alias: upgrade disable all

            show            - show current settings and upgrades

            start           - start script
            stop            - stop script

        types:
            node        - upgrade nodes
            server      - spend hashes on lower security or up max money on servers
            gym         - spend hashes on up gym multiplier
            study       - spend hashes on up stdudy multiplier
            corp        - corporates funds
            ?

*/

import {Constants}  from "/h3ml/lib/constants.js";
import {Logger}     from "/h3ml/lib/log.js";

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
    ns.tprintf("usage: %s cmd options | --version [--update-port] | --help", Module);
    ns.tprintf("hacknet cli ctrl");
    return;
}


const hacknet_start(l) {
    const ns = l.ns;
    Servers.list(ns)
        .forEach(server => {
            ns.ps(server.name)
                .filter(proc => proc.filename == '/h3ml/sbin/hack-hash.js')
                .forEach( proc => {
                    l.w("already started at %s", server.name);
                    return;
                })
        });
    const ctrl_server = ns.serverExists("ctrl-server") ? "ctrl-server" : "home";
    ns.exec("/h3ml/sbin/hack-hash.js", ctrl_server, 1);
    return;
}

const hacknet_ctrl_start(l, socket) {
    const infoSocket = new Socket(ns, infoPort);
    await socket.write("@", infoPort, "start");
    const [time, data] = await infoSocket.read({time: infoSocket.time, timeout: 2000});
    if (!time) {
        return l.e("failed send ctrl to hacknet module");
    }
    // FIXME analyze response
    l.g(1, "%s", data.join(''));
}

const hacknet_ctrl_stop(l, socket) {
    const infoSocket = new Socket(ns, infoPort);
    await socket.write("@", infoPort, "stop");
    const [time, data] = await infoSocket.read({time: infoSocket.time, timeout: 2000});
    if (!time) {
        return l.e("failed send ctrl to hacknet module");
    }
    l.g(1, "%s", data.join(''));
}

const hacknet_ctrl_send(l, socket, ...data) {
    const infoSocket = new Socket(ns, infoPort);
    await socket.write("@", infoPort, data.join("|"));
    const [time, data] = await infoSocket.read({time: infoSocket.time, timeout: 2000});
    if (!time) {
        return l.e("failed send ctrl to hacknet module");
    }
    l.g(1, "%s", data.join(''));
}

const hacknet_ctrl_wait(l, socket) {
    const infoSocket = new Socket(ns, infoPort);
    await socket.write("#", infoPort, data.join("|"));
    const [time, data] = await infoSocket.read({time: infoSocket.time, timeout: 2000});
    if (!time) {
        return l.e("failed send ctrl to hacknet module");
    }
    // show data in pretty format
    l.g(1, "%s", data.join(''));
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

    const l = new Logger(ns, {args: args});

    const socket = new Socket(ns, Constants.nodePort);

    const [cmd, ...options] = args["_"];
    l.g(1, "hacknet ctrl '%s'", cmd);
    switch (cmd) {
        case "start":
            hacknet_start();
            hacknet_ctrl_start(l, socket);
            break;
        case "stop":
            hacknet_ctrl_stop(l, socket);
            break;
        case "max-nodes":
        case "max-level":
        case "max-core":
        case "max-cache":
        case "max-ram":
            const n = parseInt(options.shift());
            if (isNaN(n)) {
                l.e("wrong N parameter, expect %s -1..N", cmd);
                return;
            }
            hacknet_ctrl_send(l, socket, cmd, n);
            break;
        case "upgrade":
            const enable = options.shift();
            if (enable != "enable" && enable != "disable") {
                l.e("wrong cmd: upgrade enable|disable [type|all]");
                return;
            }
            const type = options.shift();
            if (type != /all|node|server|study|gym|corp|home/) {
                l.e("wrong upgrade type, allowed: all|node|server|study|gym|corp|home");
                return;
            }
            hacknet_ctrl_send(l, socket, cmd, enable, type);
            break;
        case "money":
            hacknet_ctrl_send(l, socket, cmd);
            break;
        case "show":
            hacknet_ctrl_wait(l, socket, cmd);
            break;
    }
    return;
}
