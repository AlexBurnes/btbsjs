const Module  = '/h3ml/sbin/server-hack-batch.js';
const Version = '0.3.6.30'; // update this every time when edit the code!!!

import {Constants}   from "/h3ml/lib/constants.js";
import {Logger}      from "/h3ml/lib/log.js";
import {Socket}      from "/h3ml/lib/network.js";
import {Servers}     from "/h3ml/lib/server-list.js";
import {Target}      from "/h3ml/lib/target-speed.js";
import {BotNet}      from "/h3ml/lib/botnet-min.js";
import {Table}       from "/h3ml/lib/utils.js";
import {Units}       from "/h3ml/lib/units.js";
import {updateInfo, calcGrowth, calcHack} from "/h3ml/lib/server-info-min.js";

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
    ns.tprintf("usage: %s NAME [--debug] [--analyze] [--once] | --version [--update-port] | --help", Module);
    ns.tprintf("hack server NAME");
    return;
}

const protocolVersion = Constants.protocolVersion;
const ctrlPort = Constants.ctrlPort;

function showInfo(l, table, server, botnet) {
    const ns = l.ns;
    table.push(
        server.name,
        server.minSecurity,
        server.currentSecurity,
        [server.availMoney.amount, server.availMoney.unit],
        [server.maxMoney.amount, server.maxMoney.unit],
        server.moneyRatio,
        server.serverGrowth,

        [server.hackTime.time, server.hackTime.unit],
        [server.growTime.time, server.growTime.unit],
        [server.weakTime.time, server.weakTime.unit],

        server.optimalHackThreads,
        server.optimalGrowThreads,
        server.weakCycleThreads,
        [server.optimalHackMoney.amount, server.optimalHackMoney.unit],
        server.optimalThreads,
        Units.size(server.cycleThreads*botnet.workerRam*Constants.uGb).pretty(ns),
        server.cycleTime.pretty(ns),
        server.cycleThreads
    );

    l.g(1, "%s", table.print());
}

function time2str(ns, time) {
    return ns.sprintf("%02d:%02d:%02d.%03d", time.getHours(), time.getMinutes(), time.getSeconds(), time.getMilliseconds());
}

async function hackServer(l, target, once, analyze) {
    const ns = l.ns;

    const botnet = new BotNet(ns);
    const server = new Target(l, target, botnet.servers);

    const table = new Table(ns,
        [
            // this information from servers
            ["    Name" , "%s"      ],  // server name
            ["Min "     , "%.2f"    ],  // min sucity
            ["Cur"      , "%.2f"    ],  // cure security
            ["Avail"    , "%.2f%s"  ],  // available money
            ["Max"      , "%.2f%s"  ],  // max money
            ["R"        , "%.2f"    ],  // rate to grow from available to max money
            ["Gr"       , "%d"      ],  // server growth effectivness

            ["Htm"      , "%.2f%s"  ],  // hack time
            ["Gtm"      , "%.2f%s"  ],  // grow time
            ["Wtm"      , "%.2f%s"  ],  // weaken time

            ["Hth"      , "%d"      ],  // hack threads to hack money to grow server at once
            ["Gth"      , "%d"      ],  // grow threads to grow from avail by max posible grow
            ["Wth"      , "%d"      ],  // weaken threads to down security to minimum from current

            ["Hom"      , "%.2f%s"  ],  // hack optimal money max - grow threshold value
            ["Oth"      , "%d"      ],  // optimal max threads
            ["sz"       , "%s"      ],  // server size require
            ['Ct'       , "%s"      ],  // Cycle time, week time + 4*gaps
            ['Cth'      , "%d"      ],  // cycle threads hack + hack_weaken + grow + grow+weaken
        ],
    );

    const gap_timeout = 100;
    const socket = new Socket(ns, Constants.watchPort);
    l.g(1, "'%s' initial state", server.name);
    updateInfo(ns, server);
    while (true) {

        while (server.moneyRatio > 2 || server.minSecurity !== server.currentSecurity) {
            l.g(1, "'%s', grow and weak", server.name);
            showInfo(l, table, server, botnet);

            // grow and week batch;
            const gt = server.growMaxThreads;
            const gs = server.growSecurity;
            const ws = server.weakSecurityRate;
            const ms = server.minSecurity;
            const cs = server.currentSecurity;
            const wt = Math.ceil((cs - ms) / ws + gt * gs / ws);

            if (gt == 0 && wt == 0) break;

            const batch_time = Date.now() + gap_timeout;
            const weak_timeout = server.weakTime.value * 1000;
            const grow_timeout = server.growTime.value * 1000;
            const grow_time = batch_time + weak_timeout - gap_timeout - grow_timeout;
            const period_timeout = 2 * gap_timeout;
            l.d(1, "gt %d, grow time %d", gt, grow_time);
            const total_threads = gt + wt;
            await socket.write(">", "", batch_time, total_threads, server.name, "gw", weak_timeout + period_timeout, batch_time);
            if (gt > 0) { await server["grow"](gt, {start: grow_time, batch: batch_time})};
            await server["weaken"](wt, {start: batch_time, batch: batch_time, await: true});
            updateInfo(ns, server);
            await ns.sleep(gap_timeout); // just in case
        }

        l.g(1, "'%s' prepared state", server.name);
        showInfo(l, table, server, botnet);

        botnet.update();
        let t = botnet.workers;

        let i = 0;
        while (t >= server.cycleThreads && server.moneyRatio <= 2) {
            let start = Date.now();
            l.g(1, "%s '%s' batch hack", time2str(ns, new Date(Date.now())), server.name, i);

            const grow_threads  = server.optimalGrowThreads;
            const grow_timeout  = server.growTime.value * 1000;
            const hack_threads  = server.hackMaxThreads;
            const hack_timeout  = server.hackTime.value * 1000;
            const weak_hack_threads = Math.ceil(server.hackSecurity * hack_threads/server.weakSecurityRate);
            const weak_grow_threads = Math.ceil(server.growSecurity * grow_threads/server.weakSecurityRate);
            const weak_timeout = server.weakTime.value * 1000;
            const period_timeout  = 4 * gap_timeout;

            const batch_time = Date.now() + gap_timeout;
            const hack_weak_time = batch_time;
            const hack_time = hack_weak_time + weak_timeout - gap_timeout - hack_timeout;
            const grow_weak_time = hack_weak_time + 2 * gap_timeout;
            const grow_time = grow_weak_time + weak_timeout - gap_timeout - grow_timeout;
            const total_threads = hack_threads + weak_hack_threads + grow_threads + weak_grow_threads;

            l.g(1, "ht  time %s => %s <<%d>>", time2str(ns, new Date(hack_time)),      time2str(ns, new Date(hack_time + hack_timeout))      , hack_threads);
            l.g(1, "wht time %s => %s <<%d>>", time2str(ns, new Date(hack_weak_time)), time2str(ns, new Date(hack_weak_time + weak_timeout)) , weak_hack_threads);
            l.g(1, "gt  time %s => %s <<%d>>", time2str(ns, new Date(grow_time)),      time2str(ns, new Date(grow_time + grow_timeout))      , grow_threads);
            l.g(1, "wgt time %s => %s <<%d>>", time2str(ns, new Date(grow_weak_time)), time2str(ns, new Date(grow_weak_time + weak_timeout)) , weak_grow_threads);
            await socket.write(">", "", batch_time, total_threads, server.name, "hwgw", weak_timeout+ period_timeout, batch_time);
            await server["hack"]  (hack_threads,      {start: hack_time,         batch: batch_time});
            await server["weaken"](weak_hack_threads, {start: hack_weak_time,    batch: batch_time});
            await server["grow"]  (grow_threads,      {start: grow_time,         batch: batch_time});
            await server["weaken"](weak_grow_threads, {start: grow_weak_time,    batch: batch_time,  await: true});

            l.g(1, "%s update info", time2str(ns, new Date(Date.now())));
            updateInfo(ns, server); // check
            showInfo(l, table, server, botnet);
            await ns.sleep(gap_timeout); //just in case
            botnet.update();
            t = botnet.workers;

        }
        l.g(1, 'someting goes wrong');
        showInfo(l, table, server, botnet);
        await ns.sleep(gap_timeout); // just in case of infinit loop
    }

    l.g(1, 'done');
    return;

}

/** @param {NS} ns **/
export async function main(ns) {
     const args = ns.flags([
        [ 'version'      , false ],
        [ 'update-port'  , 0     ],
        [ 'help'         , false ],
        [ 'log'          , 1     ], // log level - 0 quiet, 1 and more verbose
        [ 'debug'        , 0     ], // debug level
        [ 'verbose'      , false ], // verbose mode, short analog of --log-level 1
        [ 'quiet'        , true  ], // quiet mode, short analog of --log-level 0
        [ 'once'         , false ],
        [ 'analyze'      , false ]

    ]);

    if (args['version']) {
        return version(ns, args['update-port']);
    }
    if (args['help']) {
        return help(ns);
    }

    ns.disableLog("ALL");

    // for modules
    const l = new Logger(ns, {args: args});

    const target = args["_"][0];

    const analyzeOnly  = args["analyze"] ? 1 : 0;
    const runOnce      = args["once"]    ? 1 : 0;

    if (!Servers.list(ns).filter(server => server.name == target).length) {
        l.e("server %s do not exists", target);
        return;
    }

    if (l.debugLevel) ns.tail();

    await hackServer(l, target, runOnce, analyzeOnly);

    if (runOnce) l.g(1, "server hack done target %s", target);

    return;
}

/**
 * @param {{servers: any[]}} data
 * @param {any[]} args
 * @returns {*[]}
 */
export function autocomplete(data, args) {
    return [...data.servers];
}
