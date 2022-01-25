const Module  = 'update-fetch.js';
const Version = '0.2.1'; // update this every time when edit the code!!!

/*
    update all scripts

*/

const logLevel   = 1;   // default log level
const debugLevel = 0;   // default debug level

import {Constants}   from "lib-constants.js";
import {Socket}      from "lib-network.js";
import {Logger}      from "log.js";
import {scriptFiles} from "file-list.js";

async function version(ns, port) {
    if (port !== undefined && port) {
        const data = ns.sprintf("%d|%d|%s|%s", Date.now(), Constants.protocolVersion, Module, Version);
        return ns.tryWritePort(Constants.updatePort, data);
    }
    ns.tprintf("version %s", Version);
    return;
}

function help(ns) {
    ns.tprintf("usage: %s --version [--update-port] | --help", Module);
    ns.tprintf("update all scripts");
    return;
}

/** @param {NS} ns **/
export async function main(ns) {
    const args = ns.flags([
        [ 'version'         , false ],
        [ 'update-port'     , 0     ],
        [ 'help'            , false ]
    ]);
    const [baseUrl] = args["_"];

    if (args['version']) {
        return version(ns, args['update-port']);
    }
    if (args['help']) {
        return help(ns);
    }
    const lg = new Logger(ns, {logLevel : logLevel, debugLevel: debugLevel});
    await update(lg, baseUrl)

    return;
}

/** @param { Logger } lg */
async function update(lg, baseUrl) {

    const host = ns.getHostname();
    lg.lg(1, "update %d files", scriptFiles.length);

    for (let i = 0; i < scriptFiles.length; i++) {
        const file = scriptFiles[i];

        lg.lg(1, "[%d/%d] get file %s", i+1, scriptFiles.length, file);

        ns.rm(`bk_${file}`);
        if (ns.fileExists(file, host)) {
            ns.mv(host, file, `bk_${file}`);
        }

        await ns.wget(`${baseUrl}${file}`, file);
        if (!ns.fileExists(file, host)) {
            lg.le("[%d/%d] failed get file %s%s as %s", i+1, scriptFiles.length, baseUrl, file, file);
            continue;
        }

        //FIXME compare file versions!!! inform user about

        lg.lg(1, "[%d/%d] got file %s success", i+1, scriptFiles.length, file);



    }
}
