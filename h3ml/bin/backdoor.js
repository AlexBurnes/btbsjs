const Module  = '/h3ml/bin/backdoor.js';
const Version = '0.3.2.27'; // update this every time when edit the code!!!

import {Constants}  from "/h3ml/lib/constants.js";
import {Logger}     from "/h3ml/lib/log.js";

async function version(ns, port) {
    if (port !== undefined && port) {
        const data = ns.sprintf("%d|%s|%s", Date.now(), Module, Version);
        return ns.tryWritePort(port, data);
    }
    ns.tprintf("module %s version %s", Module, Version);
    return;
}

/**
    @param {NS} ns
    @param {Number} port
**/
function help(ns) {
    ns.tprintf("usage: %s target | --version [--update-port] | --help", Module);
    ns.tprintf("install backdoor on target");
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

    if (args['version']) {
        return version(ns, args['update-port']);
    }
    if (args['help']) {
        return help(ns);
    }

    // for modules
    const l = new Logger(ns, {args: args});


    const [target] = args["_"];
    if (target == undefined) {
        l.e("target is undefined");
        help(ns);
    }

    const paths = {'home': []};
    const queue = Object.keys(paths);

    while (queue.length > 0) {
        const current = queue.shift();
        ns.scan(current)
            .filter(e => !paths[e])
            .forEach(server => {
                queue.push(server);
                paths[server] = paths[current].concat([server])
            })
    }

    if (!paths[target]) {
        l.e("No path found to node %s", target);
        return;
    }

    const terminalCommand = `home; ${paths[target].map(e => `connect ${e}`).join(';')}; backdoor;`

    const terminalInput = document.getElementById("terminal-input");
    terminalInput.value = terminalCommand;
    const handler = Object.keys(terminalInput)[1];

    // noinspection JSUnresolvedFunction
    terminalInput[handler].onChange({target: terminalInput});
    // noinspection JSUnresolvedFunction
    terminalInput[handler].onKeyDown({keyCode: 13, preventDefault: () => null});
}

/** @param {NS} ns **/
export function autocomplete(data, args) {
    return [...data.servers];
}
