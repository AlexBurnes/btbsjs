const Module  = '/h3ml/sbin/gather-security-data.js';
const Version = '0.3.3.13'; // update this every time when edit the code!!!

import {Constants}      from "/h3ml/lib/constants.js";
import {Logger}         from "/h3ml/lib/log.js"

const securityFile = Constants.securityFile;
const maxCpuCores  = Constants.maxHomeCpuCores;

async function version(ns, port) {
    if (port !== undefined && port) {
        const data = ns.sprintf("%d|%s|%s", Date.now(), Module, Version);
        return ns.tryWritePort(port, data);
    }
    ns.tprintf("module %s version %s", Module, Version);
    return;
}

function help(ns) {
    ns.tprintf("usage: %s  ...args | --version [--update-port] | --help", Module);
    ns.tprintf("update security data file %s", securityFile);
    return;
}

async function updateSecurityFile(l, host) {
    const ns = l.ns;
    // prepare script source code
    let data = "export const securityData = {\n";
    data += "    'growRate': " + ns.growthAnalyzeSecurity(1) + ", 'hackRate': " + ns.hackAnalyzeSecurity(1) + ",\n";
    data += "    'weakRate': [";
    for(let i = 0; i < maxCpuCores; i++) {
        data += (i == 0 ? "\n        " : ",\n        ") + ns.weakenAnalyze(1, i+1);
    }
    data += "\n    ]\n};";
    // write it
    await ns.write(securityFile, data, "w");
    return;
}

////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////
// main

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
    const [host] = args["_"];
    if (host == undefined) {
        return l.e("host is undefined");
    }

    await updateSecurityFile(l, host);
}
