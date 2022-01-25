// hack-servers.js
// version 0.1.10

///////////////////////////////
// FIXME move to constants!  //
const protocolVersion   = 2; //
const receivePort       = 1; //
const ctrlPort          = 2; //
const listenPort        = 3; //
///////////////////////////////

const debugLevel        = 0;
const logLevel          = 1;


import { Logger } from "log.js"
import { serversList } from "lib-server-list.js"
import { BotNet } from "lib-botnet.js"
import { Target } from "target.js"
import { costFormat, timeFormat } from "lib-units.js"
import { TableFormatter } from "lib-utils.js"
import { updateInfo } from "lib-server-info-full.js"

async function listHackingServers(lg, timeout) {
    const ns = lg.ns;
    const start = Date.now();
    await ns.tryWritePort(1, ns.sprintf("%d|%d|@|%d|server-hacking-list", start, protocolVersion, listenPort));
    while (Date.now() - start < timeout) { //wait 5 seconds
        const str = await ns.readPort(listenPort);
        if (str !== "NULL PORT DATA") {
            const [time, version, action, ...data] = str.split("|");
            if (time == undefined || version == undefined || version != protocolVersion) continue;
            lg.debug(1, "%d %s: %s", time, action, data.join(", "));
            if (action == "#") {
                if (data[0] == "server-hacking-list") {
                    const list = data[1].split(";").filter(server => !server.match(/^$/));
                    lg.debug(1, "hacking servers %d", list.length);
                    if (list.length > 0) {
                        list.forEach(server => lg.debug(1, "\t%s", server));
                    }
                    return list;
                }
            }

        }
        await ns.sleep(100);
    }
    return [];
}

/** @param {NS} ns **/
export async function main(ns) {
    const lg = new Logger(ns);

    const hacking_list = await listHackingServers(lg, 5000);
    const hacking_servers = new Map();
    hacking_list.forEach(item => {
        const server = item.split(",");
        const timeout = server[2] - Date.now() + parseInt(server[3]);
        const now = Date.now();
        const estimate = timeFormat(server[1] !== undefined && timeout > 0 ? timeout/1000 : 0);
        const diff_amount = costFormat(server[5]);
        const total_amount = costFormat(server[6]);
        const diff_security = server[7];
        const hack_info = [
            server[0],
            server[1],
            estimate,
            server[4],
            diff_amount,
            diff_security,
            total_amount
        ];
        //lg.debug(1, "\t%s data: %s", server[0], server.join(","));
        hacking_servers.set(server[0], hack_info);
    });

    const servers = serversList(ns)
        .filter(server => server.name !== 'home') // not home
        .filter(server => ns.getServerMaxMoney(server.name)) // has money
        .filter(server => ns.hasRootAccess(server.name)) // with root access
        .filter(server => ns.getServerRequiredHackingLevel(server.name) <= ns.getHackingLevel()); // hackable

    const botnet = new BotNet(ns);
    lg.log(1, "botnet %d memory %dGb max threads %d, used memory %dGb usage %.2f%%",
        botnet.servers.length, botnet.maxRam, botnet.workers,
        botnet.usedRam, 100 * botnet.usedRam / botnet.maxRam
    );

    if (botnet.servers.length) {
        lg.log(2, "botnet list:");
        botnet.servers
            .sort(function (a, b) { a.workers - b.workers })
            .forEach(server => {
                lg.log(2, "\t%s %dGb / %dGb, allow worker threads %d",
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
        lg.log(1, "hacking %d/%d servers", hacking_servers.size, servers.length);
        lg.log(1, "for optimal hack require max single server size %dGb, total size %dGb", oneServerRam, allServersRam);

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
}
