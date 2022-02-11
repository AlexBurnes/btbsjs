const Module  = '/h3ml/sbin/ps.js';
const Version = '0.3.6.27';  // update this every time when edit the code!!!

/**
    @param {NS} ns
    @param {Number} port
**/
async function version(ns, port) {
    if (port !== undefined && port) {
        const data = ns.sprintf("%d|%s|%s", Date.now(), Module, Version);
        return ns.tryWritePort(port, data);
    }
    ns.tprintf("module %s version %s", Module, Version);
    return;
}

function help(ns) {
    ns.tprintf("usage: %s --version [--update-port] | --help", Module);
    ns.tprintf("this module is a library, import {BotNet} from '%s'", Module); // in case of a library
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

    const host = ns.getHostname();
    const options = args["_"];

    let cmd = options.shift();
    let pattern = '.*';
    if (cmd == "|") {
        cmd = options.shift();
        if (cmd = "grep") {
            pattern = options.shift();
        }
    }

    const max_items = 100;
    const re = new RegExp(pattern);

    const procs = ns.ps(host);
    const filtered = procs.filter(proc => proc.filename.match(re) || proc.args.join('').match(re));
    if (filtered.length > 0) {
        for(let i = 0; i < Math.min(filtered.length, max_items); i++) {
            const proc = filtered[i];
            ns.tprintf("%d %s %s", proc.pid, proc.filename, proc.args.join(' '));
        }
        if (filtered.length > max_items) {
            ns.tprintf("... more %d", filtered.length - max_items);
        }
    }
    else {
        ns.tprintf("no procs running on %s", host);
    }

}
