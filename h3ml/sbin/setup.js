const Module  = '/h3ml/sbin/setup.js';
const Version = '0.3.3.12'; // update this every time when edit the code!!!

import {Constants}      from "/h3ml/lib/constants.js";
import {Logger}         from "/h3ml/lib/log.js"

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
    ns.tprintf("gather security rate into %s", securityFile);
    return;
}

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

    const [host] = args["_"];
    const l = new Logger(ns, {args: args});

    if (host == undefined) {
        return l.e("host is undefined");
    }
    await ns.sleep(500); // just wait while caller free memory :)
    l.g(1, "setup system on host %s", host);
    l.g(1, "\tgather servers data");
    const pid_1 = await ns.exec(Constants.serversFile, host, 1, host);
    if (!pid_1) {
        l.e("failed run %s", Constants.serversFile);
    }
    await ns.sleep(200);
    l.g(1, "\tgather security data");
    const pid_2 = await ns.exec(Constants.securityFile, host, 1, host);
    if (!pid_1) {
        l.e("failed run %s", Constants.securityFile);
    }
    await ns.sleep(200);
    l.g(1, "setup done");
}
