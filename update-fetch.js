const Module  = 'update-fetch.js';
const Version = '0.2.0.3'; // update this every time when edit the code!!!

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
    const ns = lg.ns;
    const host = ns.getHostname();
    lg.lg(1, "update %d files", scriptFiles.length);

    const host_files = new Map();
    ns.ls(host)
        .filter(file => file.match(/.*\.js|.*\.txt/))
        .filter(file => !file.match(/^bk_.\.js/))
        .forEach(file => {host_files.set(file, file)});

    for (let i = 0; i < scriptFiles.length; i++) {
        const file = scriptFiles[i];

        lg.lg(1, "[%d/%d] get file %s", i+1, scriptFiles.length, file);

        if (host_files.has(file)) {
            ns.rm(`bk_${file}`);
            if (ns.fileExists(file, host)) {
                ns.mv(host, file, `bk_${file}`);
            }
            host_files.set(file, `bk_${file}`);
        }

        await ns.wget(`${baseUrl}${file}`, file);
        if (!ns.fileExists(file, host)) {
            lg.le("[%d/%d] failed get file %s%s as %s", i+1, scriptFiles.length, baseUrl, file, file);
            continue;
        }

        //FIXME compare file versions!!! inform user about
        if (host_files.has(file)) {
            ns.tprintf("[%d/%d] uploaded, compare version of %s and bk_%s", i+1, scriptFiles.length, file);

            host_files.delete(file);
        }
        else {
            ns.tprintf("[%d/%d] uploaded file '%s' is new", i+1, scriptFiles.length, file);
        }

        lg.lg(1, "[%d/%d] got file %s success", i+1, scriptFiles.length, file);

    }

    if (host_files.size > 0) {
        lg.lg(1, "not updated files:");
        host_files.forEach((file, key) => {
            lg.lg(1, "\t%s");
        });
    }
}
