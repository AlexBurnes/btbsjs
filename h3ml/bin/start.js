const Module  = '/h3ml/bin/start.js';
const Version = '0.3.5.4'; // update this every time when edit the code!!!

import {Constants}  from "/h3ml/lib/constants.js";
import {Logger}     from "/h3ml/lib/log.js";
import {Socket}     from "/h3ml/lib/network.js";
import {Servers}    from "/h3ml/lib/server-list.js";

const watchPort = Constants.watchPort;
const infoPort = Constants.infoPort;

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
    ns.tprintf("usage: %s start [watch | hack [name|automate|all]]--version [--update-port] | --help", Module);
    ns.tprintf("start watcher");
    return;
}

async function start_watch(l, socket) {
    const ns = l.ns;
    Servers.list(ns)
        .forEach(server => {
            ns.ps(server.name)
                .filter(proc => proc.filename == '/h3ml/sbin/watcher.js' || proc.filename == '/h3ml/sbin/watch-min.js')
                .forEach( proc => {
                    l.w("already started at %s", server.name);
                    return;
                })
        });
    const ctrl_server = ns.serverExists("ctrl-server") ? "ctrl-server" : "home";
    if (ns.getServerMaxRam(ctrl_server) > 128) {
        ns.exec("/h3ml/sbin/watcher.js", ctrl_server, 1);
    }
    else {
        ns.exec("/h3ml/sbin/watch-min.js", ctrl_server, 1);
    }
}

async function start_hack(l, name, socket) {
    const ns = l.ns;
    const infoSocket = new Socket(ns, infoPort);
    await socket.write("@", infoPort, "start-hack", name);
    const [time, data] = await infoSocket.read({time: infoSocket.time, timeout: 2000});
    l.g(1, "watch reponse: %s", data.join(' '));
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

    const socket = new Socket(ns, watchPort);

    // default is stop watcher
    const cmd = args["_"].shift();
    if (cmd !== undefined) {
        switch (cmd) {
            case "watch":
                return await start_watch(l, socket);
            case "hack":
                const name = args["_"].shift();
                return await start_hack(l, name, socket);
            default:
                l.e("unknown command");
                return help();
        }
    }
    return await start_watch(l, socket);
}

