/*
    update h3ml script, this module must not have any library dependency
    upload this script at home computer and run:
        wget https://raw.githubusercontent.com/AlexBurnes/h3ml/devel/update.js update.js
        run update.js
*/

const Module  = 'update.js'; // replace by name of new module
const Version = '0.2.1.2';     // update this every time when edit the code!!!

const baseUrl    = "https://raw.githubusercontent.com/AlexBurnes/h3ml/devel/";

// core files required for updater
const files_list = ["file-list.js", "update-fetch.js", "lib-constants.js", "lib-log.js"];

async function version(ns, port) {
    if (port !== undefined && port) {
        const data = ns.sprintf("%d|%s|%s", Date.now(), Module, Version);
        return ns.tryWritePort(port, data);
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
        if (ns.fileExists(file, host)) {
            ns.tprintf("[%d/%d] move %s to bk_%s", i+1, files_list.length, file, file);
            ns.rm(`bk_${file}`);
            if (ns.fileExists(`bk_%{file}`, host)) {
                ns.tprintf("[%d/%d] filed delete bk_%s", i+1, files_list.length, file);
                return false;
            }
            ns.mv(host, file, `bk_${file}`);
            if (ns.fileExists(file, host)) {
                ns.tprintf("[%d/%d] filed move file %s to bk_%s", i+1, files_list.length, file, file);
                return false;
            }
        }
        await ns.wget(`${baseUrl}${file}`, file);
        if (!ns.fileExists(file, host)) {
            ns.tprintf("[%d/%d] failed get file for update %s/%s", i+1, files_list.length, baseUrl, file);
            return false;
        }
        ns.tprintf("[%d/%d] %s uploaded", i+1, files_list.length, file);
    }
    ns.tprintf("run update-fetch to complite updating");
    const pid = ns.run("update-fetch.js", 1, baseUrl);
    if (pid == 0) return false;
    return true;
}
