// hacking.js
// version 0.1.10
// list of all currently hacking servers

import {Logger} from "log.js";
import {TableFormatter} from "lib-utils.js"
import {costFormat, timeFormat} from "lib-units.js"

const protocolVersion   = 2;
const receivePort       = 1;
const ctrlPort          = 2;
const listenPort        = 3;

const debugLevel = 0;
const logLevel   = 1;

/** @param {NS} ns **/
export async function main(ns) {
    // ask wahter wich servers are hacking
    const lg = new Logger(ns, {logLevel: logLevel, debugLevel: debugLevel});
    const start = Date.now();
    const table = new TableFormatter(ns,
        [
            ["      Name",  "%s"        ],
            ["C",           "%s"        ],
            ["Time",        "%.2f%s"    ],
            ["L",           "%s"        ],
            ["Diff",        "%s%.2f%s"  ],
            ["Sec",         "%.2f"      ],
            ["Total",       "%.2f%s"    ]
        ]
    );
    await ns.tryWritePort(1, ns.sprintf("%d|%d|@|%d|server-hacking-list", start, protocolVersion, listenPort));

    while (Date.now() - start < 5000) { //wait 5 seconds
        const str = await ns.readPort(listenPort);
        if (str !== "NULL PORT DATA") {
            const [time, version, action, ...data] = str.split("|");
            if (time == undefined || version == undefined || version != protocolVersion) continue;
            l.d(1, "%d %s: %s", time, action, data.join(", "));
            if (action == "#") {
                if (data[0] == "server-hacking-list") {
                    const list = data[1].split(";").filter(server => !server.match(/^$/));
                    l.g(1, "hacking servers %d", list.length);
                    if (list.length > 0) {
                        const servers = new Array();
                        list.forEach(
                            item => {
                                const server = item.split(",");
                                const start = server[2];
                                const timeout = server[2] - Date.now() + parseInt(server[3]);
                                const now = Date.now();
                                const estimate = timeFormat(server[1] !== undefined && timeout > 0 ? timeout/1000 : 0);
                                const diff_amount = costFormat(server[5]);
                                const total_amount = costFormat(server[6]);
                                const diff_security = server[7];
                                servers.push([
                                    server[0],
                                    server[1],
                                    estimate,
                                    server[4],
                                    diff_amount,
                                    diff_security,
                                    total_amount
                                ]);
                                //l.d(1, "\t%s data: %s", server[0], server.join(","));
                            });

                        servers.sort(function(a, b){return b[6].value - a[6].value});
                        servers.forEach(server => {
                            table.push(
                                server[0],
                                server[1].substr(0, 1),
                                [server[2].time, server[2].unit],
                                server[3].substr(0, 1),
                                [server[3] == "hack" ? "-" : "+", server[4].cost, server[4].unit],
                                server[5],
                                [server[6].cost, server[6].unit]
                            );
                        });
                        table.print();
                    }
                    return;
                }
            }

        }
        await ns.sleep(100);
    }
    l.g(1, "done");
}
