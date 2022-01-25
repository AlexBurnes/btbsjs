// lib-hack-server
// version 0.2.0
/*
    functions for hack strategy and show hack servers info
*/

import { serversList } from "lib-server-list.js"
import { BotNet } from "lib-botnet.js"
import { Target } from "target.js"
import { costFormat, timeFormat } from "lib-units.js"
import { TableFormatter } from "lib-utils.js"
import { updateInfo } from "lib-server-info-full.js"

export function hackServersInfo(lg, botnet, servers, hacking_servers) {

    const ns = lg.ns;

    if (botnet.servers.length) {
        lg.lg(2, "botnet list:");
        botnet.servers
            .sort(function (a, b) { a.workers - b.workers })
            .forEach(server => {
                lg.lg(2, "\t%s %dGb / %dGb, allow worker threads %d",
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
        lg.lg(1, "hacking %d/%d servers", hacking_servers.size, servers.length);
        lg.lg(1, "for optimal hack require max single server size %dGb, total size %dGb", oneServerRam, allServersRam);

        const table = new TableFormatter(ns,
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
            const moneyHackRate = costFormat(server.threadRate);
            const hack_info = hacking_servers.has(server.name) ? hacking_servers.get(server.name) : undefined;
            table.push(
                server.name,
                100 * server.analyzeChance,
                server.minSecurity,
                server.currentSecurity,
                [server.availMoney.cost, server.availMoney.unit],
                [server.maxMoney.cost, server.maxMoney.unit],
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
                [server.optmalMaxHackMoney.cost, server.optmalMaxHackMoney.unit],
                //server.serverMaxGrowthThreads,
                //server.maxGrowSecutiryThreads,
                //server.optimalMaxThreads,
                //[moneyHackRate.cost, moneyHackRate.unit],
                //server.threadRate / totalRate * 100,
                //botnet.workers * server.threadRate / totalRate
                hack_info !== undefined ? hack_info[1].substr(0, 1) : "",
                hack_info !== undefined ? [hack_info[2].time, hack_info[2].unit] : [0, ""],
                hack_info !== undefined ? hack_info[3].substr(0, 1) : "",
                hack_info !== undefined ? [hack_info[3] == "hack" ? "-" : "+", hack_info[4].cost, hack_info[4].unit] : ["", 0, ""],
                hack_info !== undefined ? hack_info[5] : "",
                hack_info !== undefined ? [hack_info[6].cost, hack_info[6].unit] : [0, ""]
            );
        });
        table.print();
    }
    return;
}
