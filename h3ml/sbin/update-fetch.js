
"use strict";
const Module  = '/h3ml/sbin/update-fetch.js';
const Version = '0.3.0.22'; // update this every time when edit the code!!!

/*
    update all scripts

*/

import {scriptFiles} from "/h3ml/var/files.js";
import {Constants}   from "/h3ml/lib/constants.js";
import {Logger}      from "/h3ml/lib/log.js";

const core_files = ["/h3ml/var/files.js", "/h3ml/sbin/update-fetch.js", "/h3ml/lib/constants.js", "/h3ml/lib/log.js"];
const backup_path = "/h3ml/var/backup";
const waitTimeout = 2000; //default wait timwout for version from module

async function version(ns, port) {
    if (port !== undefined && port) {
        const data = ns.sprintf("%d|%s|%s", Date.now(), Module, Version);
        return ns.tryWritePort(Constants.updatePort, data);
    }
    l.g(1, "version %s", Version);
    return;
}

function help(ns) {
    l.g(1, "usage: %s [url] | [--version [--update-port]] | [--help]", Module);
    l.g(1, "update all scripts");
    return;
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
    const [baseUrl] = args["_"];

    if (args['version']) {
        return version(ns, args['update-port']);
    }
    if (args['help']) {
        return help(ns);
    }
    ns.tprint(Module, " ", Version);
    const l = new Logger(ns, {args: args});

    await update(l, baseUrl)

    return;
}

/** @param { Logger } lg **/
/** @param { String } baseUrl **/
async function update(l, baseUrl) {
    const ns = l.ns;
    const host = ns.getHostname();
    l.g(1, "update %d files", scriptFiles.length);

    if (baseUrl == undefined) {
        l.e("url to fetch from not specified");
        return help();
    }

    const filter_files = new Map();
    core_files.forEach(file => {filter_files.set(file, true);});
    const filter_re = new RegExp(`^${backup_path}.*\\.js`);

    const host_files = new Map();
    ns.ls(host)
        .filter(file => file.match(/.*\.js|.*\.txt/))
        .filter(file => !filter_files.has(file))
        .filter(file => !file.match(filter_re))
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
            l.e("[%d/%d] failed get file %s%s as %s", i+1, scriptFiles.length, baseUrl, file, file);
            continue;
        }

        //FIXME compare file versions!!! inform user about
        if (host_files.has(file)) {
            l.d(1, "[%d/%d] uploaded, compare version of %s and %s", i+1, scriptFiles.length, file, host_files.get(file));
            if (!await checkVersion(l, file, host_files.get(file))) {
                l.e("inspect old %s file, compare it with new %s", host_files.get(file), file);
                l.g(1, "[%d/%d] got file %s with warnings", i+1, scriptFiles.length, file);
                host_files.delete(file);
                continue;
            }
            host_files.delete(file);
        }
        else {
            l.g(1, "[%d/%d] uploaded file '%s' is new", i+1, scriptFiles.length, file);
        }

        l.g(1, "[%d/%d] got file %s success", i+1, scriptFiles.length, file);
    }

    //FIXME check core files versions updated by h3ml-update.js to shure that version from git is not hier than in file!
    l.g(1, "check core files %d", core_files.length);
    for(let i = 0; i < core_files.length; i++) {
        const file = core_files[i];
        l.g(1, "[%d/%d] check core file %s",  i+1, core_files.length, file);
        if (!await checkVersion(l, file, `${backup_path}${file}`)) {
            l.e("inspect old %s file, compare it with new %s", `${backup_path}${file}`, file);
            continue;
        }
        l.g(1, "[%d/%d] core file %s ok", i+1, core_files.length, file);
    }

    if (host_files.has("h3ml-update.js")) {
        host_files.delete("h3ml-update.js");
    }

    if (host_files.size > 0) {
        l.g(1, "not updated files:");
        host_files
            .forEach((file, key) => {
                l.g(1, "\t%s", file);
            });
    }
}

async function checkVersion(l, new_file, old_file) {
    const ns = l.ns;
    const host = ns.getHostname();

    l.d(1, `new file '${new_file}' old file '${old_file}'`);
    if (new_file == undefined || old_file == undefined) {
        l.e("new or old file is undefined, bug?");
        return false;
    }

    if (new_file == old_file) {
        l.e("old and new file names equal, %s vs %s, bug?", new_file, old_file);
        return false;
    }

    if (!ns.fileExists(new_file, host)) {
        l.e("new file %s do not exists, bug?");
        return false;
    }

    if (!ns.fileExists(old_file, host)) {
        l.e("old file %s do not exists, bug?");
        return false;
    }

    const [new_module_name, new_module_version] = await getModuleVersion(l, new_file);
    l.d(1, "new module %s identify as %s version %s", new_file, new_module_name, new_module_version);
    if (new_module_name == undefined || new_module_version == undefined) {
        l.e("new module %s return empty identity or/and version", new_file);
        return false;
    }
    if (new_module_name !== new_file) {
        l.e("new module identity %s not equal file name %s, something wrong", new_module_name, new_file);
        return false;
    }


    const [old_module_name, old_module_version] = await getModuleVersion(l, old_file);
    l.d(1, "old module %s identify as %s version %s", new_file, old_module_name, old_module_version);
    if (old_module_name == undefined || old_module_version == undefined) {
        l.e("new module %s return empty identity or/and version", old_file);
    }
    if (old_module_name !== new_file) {
        l.e("old module identity %s not equal file name %s, something wrong", old_module_name, new_file);
        return false;
    }

    const new_version_numbers = new_module_version.split(".");
    const old_version_numbers = old_module_version.split(".");

    for(let i = 0; i < new_version_numbers.length; i++) {
        if (i >= old_version_numbers) {
            return true;
        }
        if (new_version_numbers[i] < old_version_numbers[i]) {
            l.e("new module %s version %s is less old %s", new_file, new_module_version, old_version_module);
            return false;
        }
    }
    if (old_version_numbers.length > new_version_numbers) {
        l.e("new module %s version %s is less old %s", new_file, new_module_version, old_version_module);
        return false;
    }


    return true;
}

async function getModuleVersion(l, module) {
    // this will not save from show up errors, run modules and do what they do, but it helps do not break the job for this module!!!
    // every script that must updated by this module must be writed in module.js way!!!
    const ns = l.ns;
    const start = Date.now();
    ns.clearPort(Constants.updatePort);
    await tryCatchIgnore(async () => await ns.run(`${module}`, 1, "--version", "--update-port", Constants.updatePort));
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
