const Module  = '/h3ml/sbin/server-hack-batch.js';
const Version = '0.3.6.5'; // update this every time when edit the code!!!

import {Constants}   from "/h3ml/lib/constants.js";
import {Logger}      from "/h3ml/lib/log.js";
import {Socket}      from "/h3ml/lib/network.js";
import {Servers}     from "/h3ml/lib/server-list.js";
import {Target}      from "/h3ml/lib/target-speed.js";
import {BotNet}      from "/h3ml/lib/botnet-min.js";
import {Table}       from "/h3ml/lib/utils.js";
import {Units}       from "/h3ml/lib/units.js";
import {updateInfo} from "/h3ml/lib/server-info-min.js";

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

const actionNone  = 0;
const actionGrow  = 1;
const actionHack  = 2;
const actionWeak  = 3;

const hackInitial = 0;
const hackPrepare = 1;
const hackBatch   = 2;

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
        Units.money(server.moneyRatio).pretty(ns),
        server.serverGrowth,

        [server.hackTime.time, server.hackTime.unit],
        [server.growTime.time, server.growTime.unit],
        [server.weakTime.time, server.weakTime.unit],

        server.optimalHackThreads,
        server.optimalGrowThreads,
        server.weakCycleThreads,
        [server.optimalHackMoney.amount, server.optimalHackMoney.unit],
        server.optimalThreads,
        Units.size(server.optimalThreads*botnet.workerRam*1024*1024).pretty(ns),
        server.cycleTime.pretty(ns),
        Math.ceil(server.cycleThreads)
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

    server.hackAction   = actionNone;
    server.preferAction = actionNone;

    server.hackState    = hackInitial;

    const table = new Table(ns,
        [
            // this information from servers
            ["    Name" , "%s"      ],  // server name
            ["Min "     , "%.2f"    ],  // min sucity
            ["Cur"      , "%.2f"    ],  // cure security
            ["Avail"    , "%.2f%s"  ],  // available money
            ["Max"      , "%.2f%s"  ],  // max money
            ["R"        , "%s"      ],  // rate to grow from available to max money
            ["Gr"       , "%d"      ],  // server growth effectivness
            // this is calculated by server-info.updateInfo
            ["Htm"      , "%.2f%s"  ],  // hack time
            ["Gtm"      , "%.2f%s"  ],  // grow time
            ["Wtm"      , "%.2f%s"  ],  // weaken time

            ["Hth"      , "%d"      ],  // hack threads to hack money to grow server at once
            ["Gth"      , "%d"      ],  // grow threads to grow from avail by max posible grow
            ["Wth"      , "%d"      ],  // weaken threads to down security to minimum from current
            ["Hom"      , "%.2f%s"  ],  // hack optimal money max - grow threshold value
            ["Oth"      , "%d"      ],  // optimal max threads
            ["sz"       , "%s"      ],  // server size require
            ['Ct'       , "%s"      ],
            ['Cth'      , "%s"      ],
        ],
    );

    const socket = new Socket(ns, Constants.watchPort);

    //check workers
    /*const workers = new Map();
    Servers.list(ns).forEach(host => {
        const procs = ns.ps(host.name);
        procs
            .filter(proc => proc.filename.match(/worker(\-[^\.]+?)?\.js$/))
            .forEach(proc => {
                proc.args
                    .filter(arg => arg == server.name)
                    .forEach(() => {
                        workers.set(host.name, proc.args);
                    })
        });
    });
    workers.forEach((args, name) => {
        l.g(1, "worker at %s args: %s", name, args.join(', '));
    });*/

    const gap_timeout = 50;
    const sap_timeout = 50;
    const cores = 8;
    l.g(1, "'%s' initial state", server.name);
    updateInfo(ns, server, cores);
    botnet.update();
    let t = botnet.workers;
    showInfo(l, table, server, botnet);

    while (true) {
        // initial state

        while (server.moneyRatio > 2 || server.minSecurity !== server.currentSecurity) {
            l.g(1, "'%s', grow and weak", server.name);

            // grow and week batch;
            let gt = server.growMaxThreads;
            let wt = Math.ceil(
                (server.currentSecurity - server.minSecurity) / server.weakSecurityRate
                + server.growMaxThreads * server.growSecurity / server.weakSecurityRate
            );

            if (gt + wt  > t) {
                l.g(1, "botnet has not enough resources to grow and week");
                await ns.sleep(1000);
                updateInfo(ns, server, cores);
                botnet.update();
                t = botnet.workers;
                continue;
            }

            if (gt == 0 && wt == 0) break;

            // if can speed hack, why not grow using the same technic? what about speed grow mr smith? :|:):0
            let grow_periods = Math.min(
                Math.ceil(Math.log(server.moneyRatio)/Math.log(server.serverGrowth > 1 ? server.serverGrowth : 2)) || 1,
                Math.ceil((server.growTime.value * 1000 - gap_timeout)/(sap_timeout + gap_timeout))
            )
            l.g(1, "money ratio %s, growth %d, grow periods %d (%f) possible %f", Units.money(server.moneyRatio).pretty(ns), server.serverGrowth, grow_periods,
                Math.log(server.moneyRatio)/Math.log(server.serverGrowth), (server.growTime.value * 1000 - gap_timeout)/(sap_timeout + gap_timeout)
            );
            // don't care about wt we don't know a future result
            const start_time = Date.now();
            let total_threads = 0;
            let i = 0;
            const period_timeout = sap_timeout + gap_timeout;
            let batch_time = start_time;
            // first why do we need sleep? make calculation of fire event in future start :)
            while (gt + wt < t && i < grow_periods) {
                i++;
                //const start = Date.now();
                batch_time += (grow_periods > 1 ? period_timeout : 0);
                const weak_time = batch_time;
                const weak_timeout = server.weakTime.value * 1000;
                const grow_timeout = server.growTime.value * 1000;
                const grow_time = weak_time + weak_timeout - sap_timeout - grow_timeout;
                //l.d(1, "gt  time %s => %s <<%d>>", time2str(ns, new Date(grow_time)), time2str(ns, new Date(grow_time + grow_timeout)), gt);
                //l.d(1, "wt  time %s => %s <<%d>>", time2str(ns, new Date(weak_time)), time2str(ns, new Date(weak_time + weak_timeout)), wt);
                total_threads += gt + wt;
                if (gt > 0) {await server["grow"](gt, {start: grow_time, batch: batch_time})};
                if (i == grow_periods) {
                    l.g(1, "%s grow & weak time %s gap %.3fms, T %.3f timeout %s, gt %d wt %d", time2str(ns, new Date(start_time)),
                        Units.time(weak_timeout/1000).pretty(ns), period_timeout, grow_periods, Units.time(weak_timeout/1000).pretty(ns), gt, wt
                    );
                    await socket.write(">", "", start_time, total_threads, server.name, "gw", weak_timeout + grow_periods * (period_timeout), start_time);
                    //await ns.sleep(weak_time - Date.now() + weak_timeout + sap_timeout + gap_timeout);
                }
                await server["weaken"](wt, {start: weak_time, batch: batch_time, await: i == grow_periods ? true : false});
                //const end = Date.now();
                //const sleep_timeout = sap_timeout + gap_timeout - (end - start);
                //if (grow_periods && sleep_timeout > 0) await ns.sleep(sleep_timeout);

                botnet.update();
                t = botnet.workers;
            }
            updateInfo(ns, server, cores);
            showInfo(l, table, server, botnet);
            await ns.sleep(gap_timeout); // just in case
        }

        l.g(1, "'%s' prepared state", server.name);
        updateInfo(ns, server, cores);
        showInfo(l, table, server, botnet);

        botnet.update();
        t = botnet.workers;

        /*
            cycle_time = weak_timeout + 6 * gap_timeout
                                    1 2 3 4 5 6
                w                     |
                    h               |
                        w                |
                            g          |
                check                       | |
                next cycle
            times = int(cycle/5*gap) loop
                sleep 4 gap check
                sleep 1 gap next
            sleep  cycle%5*gap + 5gap
                check
                sleep gap (сalc how much sleep)


        */
        const cycle_threads = server.cycleThreads;
        const grow_threads  = server.optimalGrowThreads;
        const grow_timeout  = server.growTime.value * 1000;
        const hack_threads  = server.hackMaxThreads;
        const hack_timeout  = server.hackTime.value * 1000;
        const weak_hack_threads = Math.ceil(server.hackSecurity * hack_threads/server.weakSecurityRate);
        const weak_grow_threads = Math.ceil(server.growSecurity * grow_threads/server.weakSecurityRate);
        const weak_timeout = server.weakTime.value * 1000;
        const period_timeout = 2 * sap_timeout + 2 * gap_timeout;
        const cycle_time = hack_timeout - gap_timeout;
        const period_times = Math.floor(cycle_time / period_timeout);

        l.g(1, "cycle time %d period times %d", cycle_time, period_times);

        let i = 0;
        let start_time = Date.now();
        //let check_time = start_time + cycle_time;

        let total_threads = 0;
        let batch_time = start_time;
        while (t >= cycle_threads && server.moneyRatio <= 2) {
            i++;
            //let start = Date.now();
            batch_time += (period_times > 0 ? period_timeout : 0);
            //l.d(1, "%s '%s' batch hacking cycle %d", time2str(ns, new Date(batch_time)), server.name, i);
            const hack_weak_time = batch_time;
            const hack_time = hack_weak_time + weak_timeout - sap_timeout - hack_timeout;
            const grow_weak_time = hack_weak_time + sap_timeout + gap_timeout;
            const grow_time = grow_weak_time + weak_timeout - sap_timeout - grow_timeout;
            //l.d(1, "cycle time %.3f gap %.3f, T %.3f", cycle_time, period_timeout, period_times);
            //l.d(1, "ht  time %s => %s <<%d>>", time2str(ns, new Date(hack_time)),      time2str(ns, new Date(hack_time + hack_timeout))      , hack_threads);
            //l.d(1, "wht time %s => %s <<%d>>", time2str(ns, new Date(hack_weak_time)), time2str(ns, new Date(hack_weak_time + weak_timeout)) , weak_hack_threads);
            //l.d(1, "gt  time %s => %s <<%d>>", time2str(ns, new Date(grow_time)),      time2str(ns, new Date(grow_time + grow_timeout))      , grow_threads);
            //l.d(1, "wgt time %s => %s <<%d>>", time2str(ns, new Date(grow_weak_time)), time2str(ns, new Date(grow_weak_time + weak_timeout)) , weak_grow_threads);
            total_threads += hack_threads + weak_hack_threads + grow_threads + weak_grow_threads;
            await server["hack"]  (hack_threads,      {start: hack_time,         batch: batch_time});
            await server["weaken"](weak_hack_threads, {start: hack_weak_time,    batch: batch_time});
            await server["grow"]  (grow_threads,      {start: grow_time,         batch: batch_time});
            if (i >= period_times) { //  || check_time + period_timeout < start
                l.g(1, "%s hack & grow time %s gap %.3fms, T %.3f timeout %s, i %d", time2str(ns, new Date(start_time)), Units.time(cycle_time/1000).pretty(ns), period_timeout,
                    period_times, Units.time(weak_timeout/1000).pretty(ns), i
                );
                await socket.write(">", "", start_time, total_threads, server.name, "hwgw", weak_timeout+period_times * period_timeout, start_time);
            }
            await server["weaken"](weak_grow_threads, {start: grow_weak_time,    batch: batch_time, await: i >= period_times ? true : false});
            //ns.clearLog();
            if (i >= period_times) { //  || check_time + period_timeout < start
                /*l.g(1, "%s hack & grow time %s gap %.3fms, T %.3f timeout %s, i %d", time2str(ns, new Date(start_time)), Units.time(cycle_time/1000).pretty(ns), period_timeout,
                    period_times, Units.time(weak_timeout/1000).pretty(ns), i
                );
                await socket.write(">", "", start_time, total_threads, server.name, "hwgw", weak_timeout+period_times * period_timeout, start_time);
                */
                //await ns.sleep(grow_weak_time - Date.now() + weak_timeout + 2 * period_timeout);
                i = 0;
                updateInfo(ns, server, cores); // check
                botnet.update();
                t = botnet.workers;
                //check_time = Date.now() + cycle_time;
                start_time = Date.now();
                batch_time = start_time + 1000;
                continue;
            }
            //let end = Date.now();
            //let sleep_timeout = period_timeout - (end - start);
            //if (sleep_timeout > 0) await ns.sleep(sleep_timeout);
            //start = end;
            //updateInfo(ns, server, cores); // check
            //l.d(1, "%s update info", time2str(ns, new Date(Date.now())));
            //end = Date.now();
            //sleep_timeout = 1*gap_timeout - (end - start);
            //if (sleep_timeout > 0) await ns.sleep(sleep_timeout);
            botnet.update();
            t = botnet.workers;
            await ns.sleep(gap_timeout); // make it easy
        }
        //sleep forward i cycles and correct amount to max
        // check process with name

        const workers = new Map();
        /*Servers.list(ns).forEach(host => {
            const procs = ns.ps(host.name);
            procs
                .filter(proc => proc.filename.match(/worker(\-[^\.]+?)?\.js$/))
                .forEach(proc => {
                    proc.args
                        .filter(arg => arg == server.name)
                        .forEach(() => {
                            workers.set(host.name, proc.args);
                        })
            });
        });
        workers.forEach((args, name) => {
            l.g(1, "worker at %s args: %s", name, args.join(', '));
        });*/
        l.g(1, "%s something goes wrong", time2str(ns, new Date(Date.now())));
        showInfo(l, table, server, botnet);
        await ns.sleep(gap_timeout);
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
