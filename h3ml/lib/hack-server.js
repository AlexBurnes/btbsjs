const Module  = '/h3ml/lib/hack-server.js';
const Version = '0.3.5.11';     // update this every time when edit the code!!!

import {Constants}  from "/h3ml/lib/constants.js";
import {Table}      from "/h3ml/lib/utils.js";
import {updateInfo} from "/h3ml/lib/server-info.js";
import {Units}      from "/h3ml/lib/units.js"

export class HackInfo {
    constructor (l) {
        this.lg = l
        this.ns = l.ns;
        this.table = new Table(this.ns,
            [
                // this information from servers
                ["    Name" , "%s"      ],  // server name
                ["Hack"     , "%s"      ],  // hacking server
                ["Chance"   , "%.2f%%"  ],  // hack  chance
                ["Min "     , "%.2f"    ],  // min sucity
                ["Cur"      , "%.2f"    ],  // cure security
                ["Avail"    , "%.2f%s"  ],  // available money
                ["Max"      , "%.2f%s"  ],  // max money
                ["Mr"        , "%.2f"   ],  // rate to grow from available to max money
                ["Gr"       , "%d"      ],  // server growth effectivness
                ["Htm"      , "%.2f%s"  ],  // hack time
                ["Gtm"      , "%.2f%s"  ],  // grow time
                ["Wtm"      , "%.2f%s"  ],  // weaken time

                // this is calculated by server-info.updateInfo
                ["Hth"      , "%d"      ],  // hack threads to hack money to grow server at once
                ["Gth"      , "%d"      ],  // grow threads to grow from avail by max posible grow
                ["Wth"      , "%d"      ],  // weaken threads to down security to minimum from current
                ["Hom"      , "%.2f%s"  ],  // hack optimal money max - grow threshold value
                ["Oth"      , "%d"      ],  // optimal max threads
                ["sz"       , "%s"      ],  // server size require

                // this come from wather
                ["Ca"       , "%s"      ],  // current action
                ["Time"     , "%.2f%s"  ],  // remain time
                ["La"       , "%s"      ],  // previous action
                //FIXME add spent time on action
                ["Diff"     , "%s%.2f%s"],  // available money diff, + grow, - hack
                ["Sec"      , "%.2f"    ],  // secutity diff of prvious action
                ["Total"    , "%.2f%s"  ]   // total amount hacked from server
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
        servers.forEach(server => {
            updateInfo(ns, server);
            if (maxServerThreads < server.optimalThreads) {
                maxServerThreads = server.optimalThreads;
            }
            allServerThreads += server.optimalThreads;
        });

        servers.sort(
            function (b, a) {
                return (
                      1/Math.floor(Math.log10(b.maxMoney.value))*(1/b.minSecurity)*b.serverGrowth
                    - 1/Math.floor(Math.log10(a.maxMoney.value))*(1/a.minSecurity)*a.serverGrowth
                )
            }
        );

        // need to find nearest > 2^n Gb server :)
        const allServersRam = Math.ceil(botnet.workerRam * allServerThreads);
        const oneServerRam = Math.ceil(botnet.workerRam * maxServerThreads);
        data.push(ns.sprintf("hacking %d/%d servers", hacking_servers.size, servers.length));
        data.push(ns.sprintf("for optimal hack require max single server size %s, total size %s",
            Units.size(oneServerRam*Constants.uGb).pretty(ns), Units.size(allServersRam*Constants.uGb).pretty(ns)
        ));

        servers.forEach(server => {
            const moneyHackRate = Units.money(server.threadRate);
            const hack_info = hacking_servers.has(server.name) ? hacking_servers["get"](server.name) : undefined;
            table.push(
                server.name,
                hacking_servers.has(server.name) ? "yes" : "no",
                100 * server.hackChances,
                server.minSecurity,
                server.currentSecurity,
                [server.availMoney.amount, server.availMoney.unit],
                [server.maxMoney.amount, server.maxMoney.unit],
                server.moneyRatio,
                server.serverGrowth,
                [server.hackTime.time, server.hackTime.unit],
                [server.growTime.time, server.growTime.unit],
                [server.weakTime.time, server.weakTime.unit],
                server.hackThreads,
                server.growThreads,
                server.weakThreads,
                [server.optimalHackMoney.amount, server.optimalHackMoney.unit],
                server.optimalThreads,
                Units.size(server.optimalThreads*botnet.workerRam*Constants.uGb).pretty(ns),
                hack_info !== undefined ? hack_info[1].substr(0, 1) : "",
                hack_info !== undefined ? [hack_info[2].time, hack_info[2].unit] : [0, ""],
                hack_info !== undefined ? hack_info[3].substr(0, 1) : "",
                hack_info !== undefined ? [hack_info[3] == "hack" ? "-" : "+", hack_info[4].amount, hack_info[4].unit] : ["", 0, ""],
                hack_info !== undefined ? hack_info[5] : 0,
                hack_info !== undefined ? [hack_info[6].amount, hack_info[6].unit] : [0, ""]
            );
        });
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

