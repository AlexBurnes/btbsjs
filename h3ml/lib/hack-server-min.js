const Module  = '/h3ml/lib/hack-server-min.js';
const Version = '0.3.6.31';     // update this every time when edit the code!!!

import {Constants}  from "/h3ml/lib/constants.js";
import {Table}      from "/h3ml/lib/utils.js";
import {updateInfo} from "/h3ml/lib/server-info-min.js";
import {Units}      from "/h3ml/lib/units.js"

const gapTimeout = Constants.gapTimeout;

export class HackInfo {
    constructor (l) {
        this.lg = l
        this.ns = l.ns;
        this.table = new Table(this.ns,
            [
                // this information from servers
                ["    Name" , "%s"      ],  // server name
                ["Hack"     , "%s"      ],  // hacking server
                ["Min "     , "%.2f"    ],  // min sucity
                ["Cur"      , "%.2f"    ],  // cure security
                ["Avail"    , "%s"      ],  // available money
                ["Max"      , "%s"      ],  // max money
                ["Mr"       , "%s"      ],  // rate to grow from available to max money
                ["Gr"       , "%d"      ],  // server growth effectivness
                ["Hom"      , "%s"      ],  // hack optimal money avail/gr
                ["Cth"      , "%s"      ],  // cycle hack + weak + grow + weak threas
                ["Gth"      , "%s"      ],  // cycle grow + weak threas
                ["Ctm"      , "%s"      ],  // cycle time
                ["Cr"       , "%s"      ],  // cycle money/rate in minute, expected Max/(1-1/gr)/Ctm
                ["sz"       , "%s"      ],  // server size require
                ["HSth"     , "%s"      ],  // high speed hack threads requirement
                ["HSsz"     , "%s"      ],  // high speed hack memory requirement

                // this come from watcher
                ["Action"   , "%s"      ],  // current action
                ["Remain"   , "%s"      ],  // remain time
                ["Total"    , "%s"      ]   // total amount hacked from server
            ]
        );
    }
    info(botnet, servers, hacking_servers) {
        const ns = this.ns;
        const l  = this.lg;
        const table = this.table;
        const data = [];

        if (botnet.servers.length) {
            l.g(2, "botnet list:");
            botnet.servers
                .sort(function (a, b) { a.workers - b.workers })
                .forEach(server => {
                    l.d(1, "\t%s %dGb / %dGb, allow worker threads %d",
                        server.name, server.maxRam, server.usedRam, server.workers
                    );
                });
        }

        if (!servers.length) return data;

        let allServerThreads = 0;
        let maxServerThreads = 0;
        let speedHackThreads = 0;
        let totalHackMoney   = 0;
        let totalUsedThreads = 0;
        servers.forEach(server => {
            updateInfo(ns, server);
            if (maxServerThreads < server.cycleThreads) {
                maxServerThreads = server.cycleThreads;
            }
            allServerThreads += server.cycleThreads;
            speedHackThreads += server.cycleThreads * Math.ceil(server.hackTime.value / (4 * gapTimeout * 1000));
            if (hacking_servers.has(server.name)) {
                totalUsedThreads += server.cycleThreads;
            }
        });

        servers.sort(
            function (b, a) {
                return (
                      1/Math.floor(Math.log10(b.maxMoney.value))*(1/b.minSecurity)*b.serverGrowth*1/b.cycleTime.value
                    - 1/Math.floor(Math.log10(a.maxMoney.value))*(1/a.minSecurity)*a.serverGrowth*1/b.cycleTime.value
                )
            }
        );

        /*servers.sort(
            function (a, b) {
                return (b.cycleTime.value - a.cycleTime.value)
            }
        );*/

        // need to find nearest > 2^n Gb server :)
        const allServersRam = Math.ceil(botnet.workerRam * allServerThreads);
        const oneServerRam = Math.ceil(botnet.workerRam * maxServerThreads);
        const speedHackRam = Math.ceil(botnet.workerRam * speedHackThreads);
        data.push(ns.sprintf("hacking %d/%d servers", hacking_servers.size, servers.length));
        data.push(ns.sprintf("for optimal hack require max single server size %s, total size %s, speed hack size %s",
            Units.size(oneServerRam*Constants.uGb).pretty(ns), Units.size(allServersRam*Constants.uGb).pretty(ns), Units.size(speedHackRam*Constants.uGb).pretty(ns)
        ));

        servers.forEach(server => {
            const hack_info = hacking_servers.has(server.name) ? hacking_servers["get"](server.name) : undefined;
            table.push(
                  server.name
                , hacking_servers.has(server.name) ? "yes" : "no"
                , server.minSecurity
                , server.currentSecurity
                , server.availMoney.pretty(ns)
                , server.maxMoney.pretty(ns)
                , Units.money(server.moneyRatio).pretty(ns)
                , server.serverGrowth
                , server.optimalHackMoney.pretty(ns)
                , Units.money(server.cycleThreads).pretty(ns)
                , Units.money(server.cycleGrowThreads).pretty(ns)
                , server.cycleTime.pretty(ns)
                , Units.money(server.hackMaxAmount/server.cycleTime.value).pretty(ns)
                , Units.size(server.cycleThreads * botnet.workerRam * Constants.uGb).pretty(ns)
                , Units.money(server.cycleThreads * Math.ceil(server.hackTime.value / (4 * gapTimeout * 1000))).pretty(ns)
                , Units.size(server.cycleThreads * Math.ceil(server.hackTime.value / (4 * gapTimeout * 1000)) * botnet.workerRam * Constants.uGb).pretty(ns)
                , hack_info !== undefined ? hack_info[1] : ""
                , hack_info !== undefined ? hack_info[2].pretty(ns) : ""
                , hack_info !== undefined ? hack_info[6].pretty(ns) : ""
            );
        });
        table.push(
            "Total", "", 0, 0, "", "", "", 0, "", Units.money(totalUsedThreads).pretty(ns), "", "", "", "", "", "", "", "" , ""
        )
        data.push(ns.sprintf("%s", table.print()));
        return data;
    }
}

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
    ns.tprintf("this module is a library, import {hackInfo} from '%s'", Module);
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
    help(ns);
    return;
}
