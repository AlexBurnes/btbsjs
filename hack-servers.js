// hack-servers.js
// version 0.1.0

import {Logger} from "log.js"
import {serversList} from "lib-server-list.js"
import {Target} from "target.js"
import {costFormat, timeFormat} from "lib-units.js"
import {TableFormatter} from "lib-utils.js"
import {updateInfo} from "lib-server-info-full.js"

/** @param {NS} ns **/
export async function main(ns) {
    const lg = new Logger(ns);

    const servers = serversList(ns)
        .filter(server => server.name !== 'home') // not home
        .filter(server => ns.getServerMaxMoney(server.name)) // has money
        .filter(server => ns.hasRootAccess(server.name)) // with root access
        .filter(server => ns.getServerRequiredHackingLevel(server.name) <= ns.getHackingLevel()); // hackable

    let maxNetworkMemory = 0;
    let usedNetworkMemory = 0;
    const memoryTreshold = ns.getScriptRam("worker.js");
    lg.log(1, "worker script required %.2fGb", memoryTreshold);
    const botnet = serversList(ns)
        .filter(server => ns.hasRootAccess(server.name))
        .filter(server => ns.getServerMaxRam(server.name) > memoryTreshold)
        .filter(server => ns.fileExists('worker.js', server.name));

    botnet.forEach(server => {
        server.maxRam = ns.getServerMaxRam(server.name);
        server.usedRam = ns.getServerUsedRam(server.name);
        server.workers = Math.floor((server.maxRam - server.usedRam)/memoryTreshold);
        maxNetworkMemory += server.maxRam;
        usedNetworkMemory += ns.getServerUsedRam(server.name);
    });

    lg.log(1, "botnet %d memory %dGb max threads %d, used memory %dGb usage %.2f%%",
    botnet.length, maxNetworkMemory, Math.floor(maxNetworkMemory/memoryTreshold),
    usedNetworkMemory, 100 * usedNetworkMemory/maxNetworkMemory
    );

    if (botnet.length) {
        lg.log(1, "botnet list:");
        botnet
            .sort(function(a, b){ a.workers - b.workers})
            .forEach(server => {
            lg.log(1, "\t%s %dGb / %dGb, allow worker threads %d",
            server.name, server.maxRam, server.usedRam, server.workers
            );
        });
    }

    const scripts = new Map();
    ns.ps(ns.getHostname())
        .filter(p => p.filename == 'server-hack.js')
        .forEach(p => {scripts.set(p.args[0], p)});


    lg.log(1, "hacking servers %d/%d", scripts.size, servers.length);
    if (servers.length) {
        lg.log(1, "server list:");
        //sort by hacking chance descending
        //servers.sort(function(a, b){return ns.hackAnalyzeChance(b.name) - ns.hackAnalyzeChance(a.name)});

        // sort by hackin level ascending
        servers.sort(function(a, b){return ns.getServerRequiredHackingLevel(a.name) - ns.getServerRequiredHackingLevel(b.name)});
        let allServerThreads = 0;
        let maxServerThreads = 0;
        servers.forEach(server => {
            updateInfo(ns, server);
            if (maxServerThreads < server.optimalMaxThreads) {
            maxServerThreads = server.optimalMaxThreads;
            }
            allServerThreads += server.optimalMaxThreads;
        });

        // need to find nearest > 2^n Gb server :)
        const allServersRam = Math.ceil(memoryTreshold*allServerThreads);
        const oneServerRam = Math.ceil(memoryTreshold*maxServerThreads);
        lg.log(1, "for optimal hack require max single server size %dGb, total size %dGb", oneServerRam, allServersRam);

        const table = new TableFormatter(ns,
            ["    Name", "Chance", "Min ",    "Cur",    "Avail",   "Max",    "Ratio",   "Hack",     "Grow",      "Weak",   "Hacking",
               "Hack r", "Grow r", "Hack Th", "Hack $", "Grow Th", "Grow $", "Weak Th", "Sec Down", "max op th", "Ram req"],
            [      "%s", "%.2f%%", "%.2f",    "%.2f",   "%.2f%s",  "%.2f%s", "%.5f",    "%.2f%s",   "%.2f%s",    "%.2f%s", "%s",
                 "%.8f", "%d",     "%d",      "%.2f%s", "%d",      "%.2f%s", "%d",      "%.2f",     "%d"       , "%dGb"]
        );

        servers.forEach(server => {
            table.push(
                server.name,
                100 * server.analyzeChance,
                server.minSecurity,
                server.currentSecurity,
                [ server.availMoney.cost, server.availMoney.unit ],
                [ server.maxMoney.cost, server.maxMoney.unit ],
                server.moneyRatio,
                [ server.hackTime.time, server.hackTime.unit ],
                [ server.growTime.time, server.growTime.unit ],
                [ server.weakTime.time, server.weakTime.unit ],
                scripts.has(server.name) ? "yes" : "no",
                server.hackMoney,
                server.serverGrowth,
                server.hackThreads,
                [ server.hackAmount.cost, server.hackAmount.unit ],
                server.growThreads,
                [ server.growAmount.cost, server.growAmount.unit ],
                server.weakThreads,
                server.weakAmount,
                server.optimalMaxThreads,
                server.optimalMaxThreads * memoryTreshold
            );
        });
        table.print();
    }
}
