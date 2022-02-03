const Module  = '/h3ml/lib/hack-server.js';
const Version = '0.3.4.12';     // update this every time when edit the code!!!

import {Constants}  from "/h3ml/lib/constants.js";
import {Servers}    from "/h3ml/lib/server-list.js";
import {BotNet}     from "/h3ml/lib/botnet.js";
import {Table}      from "/h3ml/lib/utils.js";
import {updateInfo} from "/h3ml/lib/server-info.js";
import {Units}      from "/h3ml/lib/units.js"

export function hackInfo(l, botnet, servers, hacking_servers) {
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
                ["Rt"       , "%.2f"    ],  // server rating
                ["Htm"      , "%.2f%s"  ],  // hack time
                ["Gtm"      , "%.2f%s"  ],  // grow time
                ["Wtm"      , "%.2f%s"  ],  // weaken time
                ["H"        , "%s"      ],  // hacking server
                ["Hth"      , "%d"      ],  // hack optimal threads to hack money to grow server at once
                ["Gth"      , "%d"      ],  // grow threads to grow from avail to max money
                ["Wth"      , "%d"      ],  // weaken threads to down security to minimum
                ["Hom"      , "%.2f%s"  ],  // hack optmal money
                ["C"        , "%s"      ],
                ["Time"     , "%.2f%s"  ],
                ["L"        , "%s"      ],
                ["Diff"     , "%s%.2f%s"],
                ["Sec"      , "%.2f"    ],
                ["Total"    , "%.2f%s"  ]
            ],

        );

        servers.forEach(server => {
            const moneyHackRate = Units.money(server.threadRate);
            const hack_info = hacking_servers.has(server.name) ? hacking_servers["get"](server.name) : undefined;
            table.push(
                server.name,
                100 * server.hackChances,
                server.minSecurity,
                server.currentSecurity,
                [server.availMoney.amount, server.availMoney.unit],
                [server.maxMoney.amount, server.maxMoney.unit],
                server.moneyRatio,
                server.serverGrowth,
                Math.floor(Math.log(server.maxMoney.value))*(1/server.minSecurity)*server.serverGrowth,
                [server.hackTime.time, server.hackTime.unit],
                [server.growTime.time, server.growTime.unit],
                [server.weakTime.time, server.weakTime.unit],
                hacking_servers.has(server.name) ? "yes" : "no",
                server.optimalMaxHackTreads,
                server.growThreads,
                server.weakThreads,
                [server.optmalMaxHackMoney.amount, server.optmalMaxHackMoney.unit],
                hack_info !== undefined ? hack_info[1].substr(0, 1) : "",
                hack_info !== undefined ? [hack_info[2].time, hack_info[2].unit] : [0, ""],
                hack_info !== undefined ? hack_info[3].substr(0, 1) : "",
                hack_info !== undefined ? [hack_info[3] == "hack" ? "-" : "+", hack_info[4].amount, hack_info[4].unit] : ["", 0, ""],
                hack_info !== undefined ? hack_info[5] : 0,
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

