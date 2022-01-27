const Module  = 'update-fetch.js';
const Version = '0.3.0.4'; // update this every time when edit the code!!!

/*
    update all scripts

*/

import {scriptFiles} from "/h3ml/var/filet.js";
import {Constants}   from "/h3ml/lib/constants.js";
import {Logger}      from "/h3ml/lib/log.js";

const backup_path = "/h3ml/var/backup";
const waitTimeout = 2000; //default wait timwout for version from module

async function version(ns, port) {
    if (port !== undefined && port) {
        const data = ns.sprintf("%d|%s|%s", Date.now(), Module, Version);
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
        [ 'version'     , false ],
        [ 'update-port' , 0     ],
        [ 'help'        , false ]
        [ 'log'         , 1     ], // log level - 0 quiet, 1 and more verbose
        [ 'debug'       , 0     ], // debug level
        [ 'verbose'     , true  ], // verbose mode, short analog of --log-level 1
        [ 'quiet'       , false ]  // quiet mode, short analog of --log-level 0

    ]);
    const [baseUrl] = args["_"];

    if (args['version']) {
        return version(ns, args['update-port']);
    }
    if (args['help']) {
        return help(ns);
    }
    const l = new Logger(ns, {args: args});
    l.g(1, "%s %s", Module, Version);

    await update(l, baseUrl)

    return;
}

/** @param { Logger } lg **/
/** @param { String } baseUrl **/
async function update(l, baseUrl) {
    const ns = l.ns;
    const host = ns.getHostname();
    l.g(1, "update %d files", scriptFiles.length);

    const host_files = new Map();
    ns.ls(host)
        .filter(file => file.match(/.*\.js|.*\.txt/))
        .filter(file => !file.match(/^${backup_path}.*\.js/))
        .forEach(file => {host_files.set(file, file)});

    for (let i = 0; i < scriptFiles.length; i++) {
        const file = scriptFiles[i];

        l.g(1, "[%d/%d] get file %s", i+1, scriptFiles.length, file);

        if (host_files.has(file)) {
            ns.rm(`${backup_path}${file}`);
            if (ns.fileExists(file, host)) {
                ns.mv(host, file, `${backup_path}${file}`);
            }
            host_files.set(file, `${backup_path}${file}`);
        }

        await ns.wget(`${baseUrl}${file}`, file);
        if (!ns.fileExists(file, host)) {
            lg.le("[%d/%d] failed get file %s%s as %s", i+1, scriptFiles.length, baseUrl, file, file);
            continue;
        }

        //FIXME compare file versions!!! inform user about
        if (host_files.has(file)) {
            // FIXME not all scripts supported updater
            /*
                ns.tprintf("[%d/%d] uploaded, compare version of %s and %s", i+1, scriptFiles.length, file, host_files.get(file));
                const [old_module_name, old_module_version] = await getModuleVersion(ns, socket, host_files.get(file), 2000);
                l.g(1, "old module %s version %s", file, old_module_version);
                const [new_module_name, new_module_version] = await getModuleVersion(ns, socket, file, 2000);
                l.g(1, "new module %s version %s", file, new_module_version);

                and compare with constants version as global update version!!!
            */
            host_files.delete(file);
        }
        else {
            ns.tprintf("[%d/%d] uploaded file '%s' is new", i+1, scriptFiles.length, file);
        }

        l.g(1, "[%d/%d] got file %s success", i+1, scriptFiles.length, file);

    }

    if (host_files.size > 0) {
        l.g(1, "not updated files:");
        host_files.forEach((file, key) => {
            l.g(1, "\t%s", file);
        });
    }
}

async function getModuleVersion(ns, module) {
    // this will not save from show up errors, run modules and do what they do, but it helps do not break the job for this module!!!
    // every script that must updated by this module must be writed in module.js way!!!
    await tryCatchIgnore(async () => await ns.run(`${module}`, 1, "--version", "--update-port", Constants.updatePort));
    const start = Date.now();
    while (true) {
        const str = await ns.readPort(Constants.updatePort);
        if (str !== "NULL PORT DATA") {
            const [time, ...data] = str.split("|");
            if (time == undefined || time < start) {
                if (Date.now() - start >= waitTimeout) break;
                continue;
            }
            return data;
        }
        if (Date.now() - start >= waitTimeout) break;
        await ns.sleep(100);
    }
    return;
}

/**
 * @param {(() => Promise<void>) | (() => void)} lambda
 * @returns {Promise<void>}
 */
async function tryCatchIgnore(lambda) {
    try {
        await lambda();
    } catch (e) {
        // ignore
    }
}
