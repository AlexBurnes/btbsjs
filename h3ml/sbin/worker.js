const Module  = '/h3ml/sbin/worker.js';
const Version = '0.3.2.19'; // update this every time when edit the code!!!

import {Constants}  from "/h3ml/lib/constants.js";
import {Socket}     from "/h3ml/lib/network.js";

async function version(ns, port) {
    if (port !== undefined && port) {
        const data = ns.sprintf("%d|%s|%s", Date.now(), Module, Version);
        return ns.tryWritePort(port, data);
    }
    ns.tprintf("version %s", Version);
    return;
}

function help(ns) {
    ns.tprintf("usage: %s  ...args | --version [--update-port] | --help", Module);
    ns.tprintf("its is a worker for h3ml to do action on target host: hack, grow, weakern '%s'");
    ns.tprintf("this module is used by target library to spread work across targets");
    return;
}


/**
 * @param {import("Ns").NS } ns
 * @returns {void}
 */
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
    const [target, method, time, host, threads, end] = args["_"];

    if (time > Date.now()) await ns.sleep(time - Date.now());
    const hostName   = host    == undefined ? "" : host;
    const threadsNum = threads == undefined ? 0  : threads;

    const socket = new Socket(ns, Constants.watchPort);

    socket.write(">", hostName, time, threadsNum, target, method, end);

    const result = await ns[method](target);

    await socket.write("<", hostName, time, threadsNum, target, method, result));

}

/** @param {import("Ns").NS } ns */
async function staticMemory(ns) {
    await ns.grow('');
}
