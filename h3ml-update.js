/*
    h3ml update script, this module must not have any library dependency
    upload this script at home computer and run:
        wget https://raw.githubusercontent.com/AlexBurnes/h3ml/devel/h3ml-update.js h3ml-update.js
        run h3ml-update.js --version
        run h3ml-update.js
*/
"use strict";
const Module  = '/h3ml-update.js';
const Version = '0.3.6.33'; // update this every time when edit the code!!!

const baseUrl    = "https://raw.githubusercontent.com/AlexBurnes/h3ml/devel";
const setupPort  = 6;

// core files required for updater
const files_list = [
      "/h3ml/var/files.js"                  // list of files to update
    , "/h3ml/sbin/update-fetch.js"          // updater, download and check files
    , "/h3ml/lib/constants.js"              // lib constants
    , "/h3ml/lib/log.js"                    // lib log
    , "/h3ml/sbin/setup.js"                 // setup script

    , "/h3ml/etc/settings.js"               // system settings
    , "/h3ml/etc/scripts.js"
    , "/h3ml/etc/servers.js"
    , "/h3ml/etc/security.js"
    , "/h3ml/etc/shares.js"

];

const update_fetch = "/h3ml/sbin/update-fetch.js";
const setup_script = "/h3ml/sbin/setup.js";

////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////
/// version
async function version(ns, port) {
    if (port !== undefined && port) {
        const data = ns.sprintf("%d|%s|%s", Date.now(), Module, Version);
        return ns.tryWritePort(port, data);
    }
    ns.tprintf("module %s version %s", Module, Version);
    return;
}

////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////
/// help
function help(ns) {
    ns.tprintf("usage: %s --version [--update-port] | --help", Module);
    ns.tprintf("update script from github");
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
    ns.print(Module, " ", Version);
    const result = await update(ns);
    if (!result) {
        ns.tprintf("failed update");
        return;
    }
    ns.print("done updating");
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
// update

/** @param {import("Ns").NS } ns */
async function update(ns) {
    const host = ns.getHostname();
    const update_success = true;

    ns.clearPort(setupPort);

    ////////////////////////////////////////////////////////////////////////////////////////////////////////////////////
    // before upload core files, upload setup and run it
    if (! await ns.wget(`${baseUrl}${setup_script}`, setup_script)) {
        ns.tprintf("ERROR failed get %s", setup_script);
        return false;
    }
    const setup_pid = ns.run(setup_script, 1, host, setupPort);
    if (setup_pid == 0) {
        ns.tprintf("ERROR failed run setup");
        return false;
    }

    ////////////////////////////////////////////////////////////////////////////////////////////////////////////////////
    // write to setup start working
    if (!await wait_setup(ns, "initial-phase")) return;

    ////////////////////////////////////////////////////////////////////////////////////////////////////////////////////
    // upload core files
    if (!await wait_setup(ns, "pre-upload-phase", files_list.length)) return;

    ns.print("uploading core files from ", baseUrl);
    for(let i = 0; i < files_list.length; i++) {
        const file = files_list[i];
        if (! await ns.wget(`${baseUrl}${file}`, file)) {
            ns.tprintf("ERROR failed get %s", i+1, files_list.length, file);
            return false;
        }
        if (!await wait_setup(ns, "pre-uploading-phase", i)) return;
        ns.print(ns.sprintf("[%d/%d] %s uploaded", i+1, files_list.length, file));
    }

    ////////////////////////////////////////////////////////////////////////////////////////////////////////////////////
    // copy settings if not exists
    if (!await wait_setup(ns, "pre-setup-phase")) return;
    // settings files, if not exists copy it, is user configurated file
    if (!ns.fileExists("h3ml-settings", host)) {
        await ns.mv(host, "/h3ml/etc/settings.js", "h3ml-settings.js");
    }

    ////////////////////////////////////////////////////////////////////////////////////////////////////////////////////
    // run updater
    if (!await wait_setup(ns, "run-updater-phase")) return;
    ns.print("run h3ml update-fetch to complite updating");
    const pid = ns.run(update_fetch, 1, baseUrl, host, setupPort);
    if (pid == 0) {
        ns.tprintf("ERROR failed run update script");
        return false;
    }
    return true;
}

////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////
////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////

