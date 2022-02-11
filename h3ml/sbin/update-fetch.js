"use strict";
const Module  = '/h3ml/sbin/update-fetch.js';
const Version = '0.3.6.24'; // update this every time when edit the code!!!

/*
    update all scripts
*/

import {scriptFiles} from "/h3ml/var/files.js";
import {Constants}   from "/h3ml/lib/constants.js";
import {Logger}      from "/h3ml/lib/log.js";

const core_files = ["/h3ml/sbin/update-fetch.js", "/h3ml/lib/constants.js", "/h3ml/lib/log.js"];
const waitTimeout = 5000; //default wait timwout for version from module
const setupPort   = 6;

////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////
// version
async function version(ns, port) {
    if (port !== undefined && port) {
        const data = ns.sprintf("%d|%s|%s", Date.now(), Module, Version);
        return ns.tryWritePort(Constants.updatePort, data);
    }
    ns.tprintf("module %s version %s", Module, Version);
    return;
}

////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////
// help
function help(ns) {
    ns.tprintf("usage: %s url host | [--version [--update-port]] | [--help]", Module);
    ns.tprintf("update all scripts");
    return;
}

////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////
////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////
///
/// main
///

/** @param {NS} ns **/
export async function main(ns) {
    const args = ns.flags([
        [ 'version'         , false ],
        [ 'update-port'     , 0     ],
        [ 'help'            , false ],
        [ 'log'             , 1     ], // log level - 0 quiet, 1 and more verbose
        [ 'debug'           , 0     ], // debug level
        [ 'verbose'         , false ], // verbose mode, short analog of --log-level 1
        [ 'quiet'           , true  ]  // quiet mode, short analog of --log-level 0

    ]);
    const [baseUrl, host, setupPort] = args["_"];

    if (args['version']) {
        return version(ns, args['update-port']);
    }
    if (args['help']) {
        return help(ns);
    }
    ns.tprint(Module, " ", Version);
    const l = new Logger(ns, {args: args});

    await update(l, baseUrl, host);

    return;
}

////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////
// wait while seupt is readed data from port
async function wait_setup(ns, ...data) {
    await ns.tryWritePort(setupPort, data.join("|"));
    //FIXME timeout
    const wait_timeout = 3000;
    const start_time = Date.now();
    while (true) {
        const str = await ns.peek(setupPort);
        //ns.tprint(str);
        if (str == 'NULL PORT DATA') break;
        if (Date.now() - start_time > wait_timeout) {
            ns.tprintf("ERROR setup is not working, something goes wrong");
            return false;
        }
        await ns.sleep(100);
    }
    return true;
}

////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////
// upload files
/** @param { Logger } lg **/
/** @param { String } baseUrl **/
async function update(l, baseUrl, host) {
    const ns = l.ns;
    l.g(1, "update %d files", scriptFiles.length);

    if (baseUrl == undefined) {
        l.e("url to fetch from not specified");
        return help(ns);
    }

    l.g(1, "version of system is %s", Constants.version);

    if (!await wait_setup(ns, "upload-updater-phase", scriptFiles.length)) return;
    const scripts = new Map();
    await updateRamScriptsFile(l, scripts, host);

    for (let i = 0; i < scriptFiles.length; i++) {
        const file = scriptFiles[i];
        if (!await wait_setup(ns, "uploading-updater-phase", i)) return;
        l.g(2, "[%d/%d] get file %s", i+1, scriptFiles.length, file);

        if (! await ns.wget(`${baseUrl}${file}`, file)) {
            l.e("[%d/%d] failed get file %s%s as %s", i+1, scriptFiles.length, baseUrl, file, file);
            continue;
        }

        //do not check script and txt for version and etc, don't care about it
        if (file.match(/^(?:.*\.script|.*\.txt)$/)) {
            l.g(1, "[%d/%d] got file %s success", i+1, scriptFiles.length, file);
            continue;
        }

        scripts.set(file, ns.getScriptRam(file, host));

        if (scripts["get"](file) == 0) {
            l.e("[%d/%d] %s uploaded, but unable to check its version, scrip require 0Gb, syntax error", i+1, scriptFiles.length, file);
            continue;
        }

        const hostFreeRam = ns.getServerMaxRam(host) - ns.getServerUsedRam(host);
        if (scripts["get"](file) > hostFreeRam) {
            l.w("[%d/%d] %s uploaded, but unable to check its version, require %.2fG, but server has %.2fG", i+1, scriptFiles.length, file, scripts["get"](file), hostFreeRam);
            continue;
        }

        const [module_name, module_version] = await checkVersion(l, host, file);
        if (module_name == undefined) {
            l.g(1, "[%d/%d] got file %s with warnings", i+1, scriptFiles.length, file);
            continue;
        }

        l.g(1, "[%d/%d] got file %s success, version %s, memory require %.2fGb", i+1, scriptFiles.length, file, module_version, scripts["get"](file));
    }


    if (!await wait_setup(ns, "post-setup-phase")) return;

    //FIXME check core files versions updated by h3ml-update.js to shure that version from git is not hier than in file!
    l.g(1, "check core files %d", core_files.length);
    let [module_name, module_version] = [];
    for(let i = 0; i < core_files.length; i++) {
        const file = core_files[i];
        scripts.set(file, ns.getScriptRam(file));
        if (scripts["get"](file) == 0) {
            l.e("[%d/%d] %s uploaded, but unable to check its version, scrip require 0Gb, syntax error", i+1, core_files.length, file);
            continue;
        }
        if (Module !== file) {
            const hostFreeRam = ns.getServerMaxRam(host) - ns.getServerUsedRam(host);
            if (scripts["get"](file) > hostFreeRam) {
                l.w("[%d/%d] %s uploaded, but unable to check its version, require %.2fG, but server has %.2fG", i+1, core_files.length, file, scripts["get"](file), hostFreeRam);
                continue;
            }

            l.g(1, "[%d/%d] check core file %s",  i+1, core_files.length, file);
            [module_name, module_version] = await checkVersion(l, host, file);
            if (module_name == undefined) {
                l.g(1, "[%d/%d] core file %s with warnings", i+1, scriptFiles.length, file);
                continue;
            }
        }
        else {
            [module_name, module_version] = [Module, Version];
        }
        l.g(1, "[%d/%d] core file %s ok, version %s, memory require %fGb", i+1, core_files.length, file, module_version, scripts["get"](file));

    }

    await updateRamScriptsFile(l, scripts);
    l.r("updating done");

}

////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////
// upddate script files ram requirement data
/** @param {Logger} l
    @param {Map{String, Number}} scripts
    @param {String} host
**/
async function updateRamScriptsFile(l, scripts, host) {
    const ns = l.ns;
    // prepare script source code
    let scripts_data = "export const ScriptFiles = {";
    let i = 0;
    scripts.forEach((value, key) => {
        scripts_data += (i++ > 0 ? ",\n" : "\n");
        scripts_data += "\t\"" + key + "\": " + value;
    });
    scripts_data += "\n};";
    // write it
    await ns.write(Constants.scriptsFile, scripts_data, "w");
    return;
}

////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////
// check uploaded module version
async function checkVersion(l, host, file) {
    const [module_name, module_version] = await getModuleVersion(l, host, file);
    l.d(1, "module %s identify as %s version %s", file, module_name, module_version);
    if (module_name == undefined || module_version == undefined) {
        l.e("module %s return empty identity or/and version", file);
        return [];
    }
    if (module_name !== file) {
        l.e("module identity %s not equal file name %s, something wrong", module_name, file);
        return [];
    }
    return [module_name, module_version];
}

////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////
// get uploaded module version
async function getModuleVersion(l, host, module) {
    // this will not save from show up errors, run modules and do what they do, but it helps do not break the job for this module!!!
    // every script that must updated by this module must be writed in module.js way!!!
    const ns = l.ns;
    if (ns.getScriptRam(module, host) == 0) {
        l.e("can't get %s version, script ram size if 0, syntax error?", module);
        return [];
    }
    if (ns.getScriptRam(module, host) > ns.getServerMaxRam(host) - ns.getServerUsedRam(host)) {
        l.e("can't get %s version, script ram size require %.2f, host %s has free %.2f",
            module, ns.getScriptRam(module, host), host, ns.getServerMaxRam(host) - ns.getServerUsedRam(host)
        );
        return [];
    }

    const start = Date.now();
    ns.clearPort(Constants.updatePort);
    const pid = await tryCatchIgnore(async () => await ns.run(module, 1, "--version", "--update-port", Constants.updatePort));
    if (!pid) return [];
    while (true) {
        const str = await ns.readPort(Constants.updatePort);
        if (str !== "NULL PORT DATA") {
            const [time, ...data] = str.split("|");
            if (time == undefined || time < start) {
                if (Date.now() - start >= waitTimeout) break;
                continue;
            }
            l.d(1, "module %s returns: %s", module, data.join(","));
            while(ns.isRunning(module, host, "--version", "--update-port", Constants.updatePort)) {
                await ns.sleep(100);
            }
            return data;
        }
        if (Date.now() - start >= waitTimeout) break;
        await ns.sleep(100);
    }
    while(ns.isRunning(module, host, "--version", "--update-port", Constants.updatePort)) {
        await ns.sleep(100);
    }
    return [];
}

////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////
// lambda ignore error
/**
 * @param {(() => Promise<void>) | (() => void)} lambda
 * @returns {Promise<void>}
 */
async function tryCatchIgnore(lambda) {
    try {
        return await lambda();
    } catch (e) {
        // ignore ?
        return;
    }
}
