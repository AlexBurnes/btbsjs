const Module  = '/h3ml/bin/h3ml.js';
const Version = '0.3.6.28'; // update this every time when edit the code!!!

import {Constants}  from "/h3ml/lib/constants.js";
import {Logger}     from "/h3ml/lib/log.js";
import {Socket}     from "/h3ml/lib/network.js"
import {Servers}    from "/h3ml/lib/server-list.js"

const protocolVersion   = Constants.protocolVersion;
const watchPort         = Constants.watchPort;
const infoPort          = Constants.infoPort;

const hackScript        = "/h3ml/sbin/server-hack-speed.js";

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
    ns.tprintf("usage: %s --version [--update-port] [--help]", Module);
    ns.tprintf("start server-hack script for hackable servers on 'home' or 'hack-server' if exists");
    return;
}

/** @param {NS} ns **/
export async function main(ns) {
    const args = ns.flags([
        [ 'version'         , false ],
        [ 'update-port'     , 0     ],
        [ 'help'            , false ]
    ]);

    if (args['version']) {
        return version(ns, args['update-port']);
    }
    if (args['help']) {
        return help(ns);
    }
    const l = new Logger(ns, {args: args});

    const hacking_servers = new Map();
    Servers.list(ns).forEach(server => {
        const procs = ns.ps(server.name);
        procs
            .filter(proc => proc.filename.match(/server-hack(\-[^\.]+?)?\.js$/))
            .forEach(proc => {
                proc.args
                    .filter(arg => typeof(arg) == 'string' && !arg.match(/^--/))
                    .forEach(arg => {
                        hacking_servers.set(arg, true);
                        l.d(1, "set %s hack %s", server.name, arg);
                    })
            });
    });

    //server-hack script could be started only on hack-server or home :)
    const hack_server = ns.serverExists("hack-server") ? "hack-server" : "home";

    Servers.list(ns)
        .filter(server => server.name !== 'home') // not home
        .filter(server => server.name !== 'ctrl-server') // not home
        .filter(server => ns.getServerMaxMoney(server.name)) // has money
        .filter(server => ns.hasRootAccess(server.name)) // with root access
        .filter(server => ns.getServerRequiredHackingLevel(server.name) <= ns.getHackingLevel())
        .forEach(server => {
            if (hacking_servers.has(server.name)) {
                l.g(2, "%s already haking", server.name);
            }
            else {
                const pid = ns.exec(hackScript, hack_server, 1, server.name);
                if (pid) {
                    l.g(1, "%s start hacking at '%s' pid %d", server.name, hack_server, pid);
                }
                else {
                    l.e("failed start haking %s at %s", server.name, hack_server);
                }
            }
        });

        l.g(1, "done");
}
