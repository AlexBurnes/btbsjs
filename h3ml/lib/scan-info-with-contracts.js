const Module  = '/h3ml/lib/scan-info-with-contracts.js';
const Version = '0.3.2.25'; // update this every time when edit the code!!!

import {Constants}  from "/h3ml/lib/constants.js";
import {Logger}     from "/h3ml/lib/log.js";
import {Servers}    from "/h3ml/lib/server-list.js";

async function version(ns, port) {
    if (port !== undefined && port) {
        const data = ns.sprintf("%d|%s|%s", Date.now(), Module, Version);
        return ns.tryWritePort(port, data);
    }
    ns.tprintf("version %s", Version);
    return;
}

/**
    @param {NS} ns
    @param {Number} port
**/
function help(ns) {
    ns.tprintf("usage: %s --version [--update-port] | --help", Module);
    ns.tprintf("this module is a library, import {some} from '%s'", Module); // in case of a library
    ns.tprintf("scan servers and output as tree with info and list of contracts");
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
    l.g(1, "%s %s", Module, Version);


    const rootKits = ns.ls('home').filter(f => Constants.rootKitFiles[f]).length;

    Servers.tree(ns, (pad, server, lvs) => {
        const hackable = ns.getHackingLevel() > ns.getServerRequiredHackingLevel(server.name) ? 1 : 0
        const rootable = rootKits >= ns.getServerNumPortsRequired(server.name) ? 1 : 0;
        const rooted   = ns.hasRootAccess(server.name) ? "🞕" : rootable ? "🞖" : "🞎";
        const hacked   = ns.getServer().backdoorInstalled == true ? "🞕" : hackable ? "🞖" : "🞎";

        const moneyAvail = moneyFormat(ns.getServerMoneyAvailable(server.name));
        const moneyMax   = moneyFormat(ns.getServerMaxMoney(server.name));

        const info = [
            "[",    ns.getServerRequiredHackingLevel(server.name),
            ", ",   ns.getServerNumPortsRequired(server.name),     "]",
            " ",    ns.getServerUsedRam(server.name),
            "/ ",   ns.getServerMaxRam(server.name),               " Gb",
            " $ ",  round(moneyAvail.amount, 2), moneyAvail.unit,
            " / ",  round(moneyMax.amount, 2), moneyMax.unit,
            " (",   moneyMax ? round((100 * moneyAvail.value / moneyMax.value), 2) : 0,
            "%)"
        ].join("");

        const contracts = ns.ls(server.name, ".cct");
        for(let i=0; i < contracts.length; i++) {
            const contract = contracts[i];
            ns.tprintf("%s © %s %s",
                lvs.pad(server.depth + 1, server.childs == 0 && i == contracts.length -1 ? 1 : 0),
                contract, ns.codingcontract.getContractType(contract, server.name)
            );
        }
        ns.tprintf("%s %s %s %s %s", pad, rooted, hacked, server.name, info);
    });
}
