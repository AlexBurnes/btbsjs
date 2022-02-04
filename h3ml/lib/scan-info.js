const Module  = '/h3ml/lib/scan-info.js';
const Version = '0.3.4.10'; // update this every time when edit the code!!!

import {Constants}  from "/h3ml/lib/constants.js";
import {Logger}     from "/h3ml/lib/log.js";
import {Servers}    from "/h3ml/lib/server-list.js";
import {Server}     from "/h3ml/lib/server.js";
import {Units}      from "/h3ml/lib/units.js";
import {round}      from "/h3ml/lib/utils.js";

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
    ns.tprintf("usage: %s --version [--update-port] | --help", Module);
    ns.tprintf("scan servers and output as tree with info");
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

    const l = new Logger(ns, {args: args});



    const rootKits = ns.ls('home').filter(f => Constants.rootKitFiles[f]).length;

    Servers.tree(ns, (pad, server) => {
        const hackable = ns.getHackingLevel() > server.hackLevel ? 1 : 0
        const rootable = rootKits >= ns.getServerNumPortsRequired(server.name) ? 1 : 0;
        const rooted   = ns.hasRootAccess(server.name) ? "🞕" : rootable ? "🞖" : "🞎";
        const hacked   = ns.getServer().backdoorInstalled == true ? "🞕" : hackable ? "🞖" : "🞎";

        const moneyAvail = Units.money(ns.getServerMoneyAvailable(server.name));
        const moneyMax   = Units.money(ns.getServerMaxMoney(server.name));

        const info = [
            "[",    ns.getServerRequiredHackingLevel(server.name),
            ", ",   ns.getServerNumPortsRequired(server.name),     "]",
            " ",    ns.getServerUsedRam(server.name),
            "/ ",   ns.getServerMaxRam(server.name),               " Gb",
            "$ ",   round(moneyAvail.amount, 2), moneyAvail.unit,
            " / ",  round(moneyMax.amount, 2), moneyMax.unit,
            " (",   moneyMax ? round((100 * moneyAvail.value / moneyMax.value), 2) : 0,
            "%)"
        ].join("");

        ns.tprintf("%s %s %s %s %s %s",
            pad, server.faction ? "☮ " : server.purshaced ? "⚒ " : "", rooted, hacked, server.name, info
        );

    },  Server);

}
