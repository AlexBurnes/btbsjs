/*
    h3ml update script, this module must not have any library dependency
    upload this script at home computer and run:
        wget https://raw.githubusercontent.com/AlexBurnes/h3ml/master/html3-update.js html3-update.js
        run h3ml-update.js --version
        run h3ml-update.js
*/

const Module  = 'h3ml-update.js';
const Version = '0.3.0.5'; // update this every time when edit the code!!!

const baseUrl    = "https://raw.githubusercontent.com/AlexBurnes/h3ml/devel-directory";

// core files required for updater
const files_list = ["/h3ml/var/files.js", "/h3ml/sbin/update-fetch.js", "/h3ml/lib/constants.js", "/h3ml/lib/log.js"];

const backup_path = "/h3ml/var/backup";

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
    ns.tprintf("uploading core files from %s", baseUrl);
    for(let i = 0; i < files_list.length; i++) {
        const file = files_list[i];
        if (ns.fileExists(file, host)) {
            ns.tprintf("[%d/%d] move %s to %s%s", i+1, files_list.length, file, back_path, file);
            ns.rm(`${backup_path}${file}`);
            if (ns.fileExists(`${backup_path}%{file}`, host)) {
                ns.tprintf("[%d/%d] failed delete ${backup_path}%s", i+1, files_list.length, file);
                return false;
            }
            ns.mv(host, file, `${backup_path}${file}`);
            if (ns.fileExists(file, host)) {
                ns.tprintf("[%d/%d] failed move file %s to ${backup_path}%s", i+1, files_list.length, file, file);
                return false;
            }
        }
        await ns.wget(`${baseUrl}${file}`, file);
        if (!ns.fileExists(file, host)) {
            ns.tprintf("[%d/%d] failed get %s", i+1, files_list.length, file);
            return false;
        }
        ns.tprintf("[%d/%d] %s uploaded", i+1, files_list.length, file);
    }
    ns.tprintf("run h3ml update-fetch to complite updating");
    const pid = ns.run("/h3ml/sbin/update-fetch.js", 1, baseUrl);
    if (pid == 0) return false;
    return true;
}
