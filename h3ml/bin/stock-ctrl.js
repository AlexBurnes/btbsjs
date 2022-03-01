const Module  = '/h3ml/bin/stock-ctrl.js';
const Version = '0.3.7.0'; // update this every time when edit the code!!!

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
    ns.tprintf("usage: %s cmd args | --version [--update-port] | --help", Module);
    ns.tprintf("stock cli ctrl");
    return;
}


const stock_start(l) {
    const ns = l.ns;
    Servers.list(ns)
        .forEach(server => {
            ns.ps(server.name)
                .filter(proc => proc.filename == '/h3ml/sbin/stock.js')
                .forEach( proc => {
                    l.w("already started at %s", server.name);
                    return;
                })
        });
    const ctrl_server = ns.serverExists("ctrl-server") ? "ctrl-server" : "home";
    ns.exec("/h3ml/sbin/stock.js", ctrl_server, 1);
    return;
}

const stock_ctrl_start(l, socket) {
    const infoSocket = new Socket(ns, infoPort);
    await socket.write("@", infoPort, "buy-all");
    const [time, data] = await infoSocket.read({time: infoSocket.time, timeout: 2000});
    if (!time) {
        return l.e("failed send ctrl to stock module");
    }
    // FIXME analyze response
    l.g(1, "%s", data.join(''));
}

const stock_ctrl_stop(l, socket) {
    const infoSocket = new Socket(ns, infoPort);
    await socket.write("@", infoPort, "sell-all");
    const [time, data] = await infoSocket.read({time: infoSocket.time, timeout: 2000});
    if (!time) {
        return l.e("failed send ctrl to stock module");
    }
    l.g(1, "%s", data.join(''));
}

const stock_ctrl_start(l, socket, sybmol) {
    const infoSocket = new Socket(ns, infoPort);
    await socket.write("@", infoPort, "start-trade", symbol);
    const [time, data] = await infoSocket.read({time: infoSocket.time, timeout: 2000});
    if (!time) {
        return l.e("failed send ctrl to stock module");
    }
    l.g(1, "%s", data.join(''));
}

const stock_ctrl_start(l, socket, sybmol) {
    const infoSocket = new Socket(ns, infoPort);
    await socket.write("@", infoPort, "stop-trade", symbol);
    const [time, data] = await infoSocket.read({time: infoSocket.time, timeout: 2000});
    if (!time) {
        return l.e("failed send ctrl to stock module");
    }
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

    const socket = new Socket(ns, Constants.stockPort);

    const [cmd, symbol] = args["_"];
    l.g(1, "stock ctrl '%s' %s", cmd, sybmol !== undefined ? sybmol : "");
    switch (cmd) {
        case "start":
            stock_start();
            stock_ctrl_start(l, socket);
            break;
        case "stop":
            stock_ctrl_stop(l, socket);
            break;
        case "buy":
            stock_ctrl_buy(l, socket, sybmol);
            break;
        case "sell":
            stock_ctrl_sell(l, socket, sybmol);
            break;
    }

}
