const Module  = '/h3ml/bin/crime-ctrl.js';
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
    ns.tprintf("crime cli ctrl");
    return;
}

const crime_start(l) {
    const ns = l.ns;
    Servers.list(ns)
        .forEach(server => {
            ns.ps(server.name)
                .filter(proc => proc.filename == '/h3ml/sbin/crime.js')
                .forEach( proc => {
                    l.w("already started at %s", server.name);
                    return;
                })
        });
    const ctrl_server = ns.serverExists("ctrl-server") ? "ctrl-server" : "home";
    ns.exec("/h3ml/sbin/crime.js", ctrl_server, 1);
    return;
}

const crime_ctrl_send(l, socket, ...data) {
    const infoSocket = new Socket(ns, infoPort);
    await socket.write("@", infoPort, data);
    const [time, data] = await infoSocket.read({time: infoSocket.time, timeout: 2000});
    if (!time) {
        return l.e("failed send ctrl to crime module");
    }
    l.g(1, "%s", data.join(''));
}

const crime_ctrl_commit(l, socket, ...data) {
    const [cmd, type] = data;
    if (type != /shop|rob|mug|larceny|drugs|traffic|homecide|gta|kidnap|assassin|heist|\d+/) {
        return l.e("wrong type of crime, typ list to show available");
    }
    return crime_ctrl_send(l, socket, data);
}

const crime_ctrl_enable(l, socket, ...data) {
    const [cmd, type] = data;
    if (type != /all|shop|rob|mug|larceny|drugs|traffic|homecide|gta|kidnap|assassin|heist|\d+/) {
        return l.e("wrong type of crime, typ list to show available");
    }
    return crime_ctrl_send(l, socket, data);
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

    const socket = new Socket(ns, Constants.crimePort);

    const [cmd, ...options] = args["_"];
    l.g(1, "crime ctrl '%s'", cmd);
    switch (cmd) {
        case "start":
            crime_start();
            crime_ctrl_send(l, socket, cmd);
            break;
        case "stop":
            crime_ctrl_send(l, socket, cmd);
            break;
        case "commit":
            crime_ctrl_commit(l, socket, cmd, options);
            break;
        case "enable":
            crime_ctrl_enable(l, socket, cmd, options);
            break;
        case "disable":
            crime_ctrl_enable(l, socket, cmd, options);
            break;
    }

}
