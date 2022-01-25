const Module  = 'update.js'; // replace by name of new module
const Version = '0.2.0.2';     // update this every time when edit the code!!!

const baseUrl    = "https://raw.githubusercontent.com/AlexBurnes/btbsjs/devel/";
const files_list = ["file-list.js", "update-fetch.js", "lib-constants.js", "lib-network.js", "log.js"];

const logLevel   = 1;   // default log level
const debugLevel = 0;   // default debug level

import {Constants}  from "lib-constants.js";
import {Logger}     from "log.js"

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
    ns.tprintf("update script from github");
    return;
}

/** @param {NS} ns **/
export async function main(ns) {
    const args = ns.flags([
        [ 'version'         , false     ],
        [ 'update-port'     , 0         ],
        [ 'help'            , false     ]
    ]);

    if (args['version']) {
        return version(ns, args['update-port']);
    }
    if (args['help']) {
        return help(ns);
    }
    // do not use anything from current libraries
    const result = await update(ns);
    if (!result) {
        ns.tprintf("failed update");
        return;
    }
    ns.tprintf("done updating");
}

/** @param {import("Ns").NS } ns */
async function update(ns) {
    const host = ns.getHostname();
    const update_success = true;
    ns.tprintf("uploading core files");
    for(let i = 0; i < files_list.length; i++) {
        const file = files_list[i];
        ns.tprintf("[%d/%d] move %s to bk_%s", i+1, files_list.length, file, file);
        ns.rm(`bk_${file}`);
        if (ns.fileExists(`bk_%{file}`, host)) {
            ns.tprintf("[%d/%d] filed delete bk_%s", i+1, files_list.length, file);
            return false;
        }
        if (ns.fileExists(file, host)) {
            ns.mv(host, file, `bk_${file}`);
        }
        if (ns.fileExists(file, host)) {
            ns.tprintf("[%d/%d] filed move file %s to bk_%s", i+1, files_list.length, file, file);
            return false;
        }
        await ns.wget(`${baseUrl}${file}`, file);
        if (!ns.fileExists(file, host)) {
            ns.tprintf("[%d/%d] failed get file for update %s/%s", i+1, files_list.length, baseUrl, file);
            return false;
        }
        ns.tprintf("[%d/%d] %s uploaded", i+1, files_list.length, file);
    }
    ns.tprintf("run update-fetch to complite updating");
    await ns.run("update-fetch.js", 1, baseUrl);
    return true;
}
