const Module  = '/h3ml/lib/hack-server.js';
const Version = '0.3.2.24';     // update this every time when edit the code!!!

import { Constants }        from "/h3ml/lib/constants.js";
import { Servers }          from "/h3ml/lib/server-list.js";
import { BotNet }           from "/h3ml/lib/botnet.js";
import { Table }            from "/h3ml/lib/utils.js";
import { updateInfo }       from "/h3ml/lib/server-info.js";
import { moneyFormat, timeFormat } from "/h3ml/lib/units.js"

export function hackServersInfo(l, botnet, servers, hacking_servers) {
    const ns = l.ns;

    if (botnet.servers.length) {
        l.g(2, "botnet list:");
        botnet.servers
            .sort(function (a, b) { a.workers - b.workers })
            .forEach(server => {
                l.g(2, "\t%s %dGb / %dGb, allow worker threads %d",
                    server.name, server.maxRam, server.usedRam, server.workers
                );
            });
    }

    if (servers.length) {

        let allServerThreads = 0;
        let maxServerThreads = 0;
        let totalRate = 0;
        servers.forEach(server => {
            updateInfo(ns, server);
            if (maxServerThreads < server.optimalMaxThreads) {
                maxServerThreads = server.optimalMaxThreads;
            }
            allServerThreads += server.optimalMaxThreads;
            totalRate += server.threadRate;
        });

        //sort by hacking chance descending
        //servers.sort(function(a, b){return ns.hackAnalyzeChance(b.name) - ns.hackAnalyzeChance(a.name)});

        // sort by hackin level ascending
        // servers.sort(function(a, b){return ns.getServerRequiredHackingLevel(a.name) - ns.getServerRequiredHackingLevel(b.name)});

        //sort by hack rate in descending
        //servers.sort(function (a, b) { return (b.threadRate - a.threadRate) });

        //sort by max money
        servers.sort(function (a, b) { return (b.maxMoney.value - a.maxMoney.value) });

        // need to find nearest > 2^n Gb server :)
        const allServersRam = Math.ceil(botnet.workerRam * allServerThreads);
        const oneServerRam = Math.ceil(botnet.workerRam * maxServerThreads);
        l.g(1, "hacking %d/%d servers", hacking_servers.size, servers.length);
        l.g(1, "for optimal hack require max single server size %dGb, total size %dGb", oneServerRam, allServersRam);

        const table = new Table(ns,
            [
                ["    Name" , "%s"      ],  // server name
                ["Chance"   , "%.2f%%"  ],  // hack  chance
                ["Min "     , "%.2f"    ],  // min sucity
                ["Cur"      , "%.2f"    ],  // cure security
                ["Avail"    , "%.2f%s"  ],  // available money
                ["Max"      , "%.2f%s"  ],  // max money
                ["R"        , "%.2f"    ],  // rate to grow from available to max money
                ["Gr"       , "%d"      ],  // server growth effectivness
                ["Htm"      , "%.2f%s"  ],  // hack time
                ["Gtm"      , "%.2f%s"  ],  // grow time
                ["Wtm"      , "%.2f%s"  ],  // weaken time
                ["H"        , "%s"      ],  // hacking server
                //["Hp"       , "%.8f"    ],  // hack money part
                //["Hth"      , "%d"      ],  // hack threads to hack all avail money
                ["Hth"      , "%d"      ],  // hack optimal threads to hack money to grow server at once
                ["Gth"      , "%d"      ],  // grow threads to grow from avail to max money
                ["Wth"      , "%d"      ],  // weaken threads to down security to minimum
                ["Hom"      , "%.2f%s"  ],  // hack optmal money
                //["HsTh"     , "%d"      ],  // hax max security threads
                //["GoTh"     , "%d"      ],  // grow optimal threads
                //["GsTh"     , "%d"      ],  // grow max security threads
                //["Max Oth"  , "%d"      ],  // maximum optimal threads required for server
                //["Hr"       , "%.2f%s"  ],  // cicle rate, cycle = n(grow+hack)+weak
                //["Thr"      , "%.2f"    ],  // thread % rate of all servers rate
                //["aTh"      , "%d"      ]   // thread to use based on Thr
                // Hacking information from watcher
                ["C",           "%s"        ],
                ["Time",        "%.2f%s"    ],
                ["L",           "%s"        ],
                ["Diff",        "%s%.2f%s"  ],
                ["Sec",         "%.2f"      ],
                ["Total",       "%.2f%s"    ]
            ],

        );

        servers.forEach(server => {
            const moneyHackRate = moneyFormat(server.threadRate);
            const hack_info = hacking_servers.has(server.name) ? hacking_servers["get"](server.name) : undefined;
            table.push(
                server.name,
                100 * server.analyzeChance,
                server.minSecurity,
                server.currentSecurity,
                [server.availMoney.amount, server.availMoney.unit],
                [server.maxMoney.amount, server.maxMoney.unit],
                server.moneyRatio,
                server.serverGrowth,
                [server.hackTime.time, server.hackTime.unit],
                [server.growTime.time, server.growTime.unit],
                [server.weakTime.time, server.weakTime.unit],
                hacking_servers.has(server.name) ? "yes" : "no",
                //server.hackMoney,
                //server.hackThreads,
                server.optimalMaxHackTreads,
                server.growThreads,
                server.weakThreads,
                //server.maxHackSecurityThreads,
                [server.optmalMaxHackMoney.amount, server.optmalMaxHackMoney.unit],
                //server.serverMaxGrowthThreads,
                //server.maxGrowSecutiryThreads,
                //server.optimalMaxThreads,
                //[moneyHackRate.amount, moneyHackRate.unit],
                //server.threadRate / totalRate * 100,
                //botnet.workers * server.threadRate / totalRate
                hack_info !== undefined ? hack_info[1].substr(0, 1) : "",
                hack_info !== undefined ? [hack_info[2].time, hack_info[2].unit] : [0, ""],
                hack_info !== undefined ? hack_info[3].substr(0, 1) : "",
                hack_info !== undefined ? [hack_info[3] == "hack" ? "-" : "+", hack_info[4].amount, hack_info[4].unit] : ["", 0, ""],
                hack_info !== undefined ? hack_info[5] : "",
                hack_info !== undefined ? [hack_info[6].amount, hack_info[6].unit] : [0, ""]
            );
        });
        table.print();
    }
    return;
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
    ns.tprintf("version %s", Version);
    return;
}

function help(ns) {
    ns.tprintf("usage: %s --version [--update-port] | --help", Module);
    ns.tprintf("this module is a library, import {hackServersInfo} from '%s'", Module);
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

