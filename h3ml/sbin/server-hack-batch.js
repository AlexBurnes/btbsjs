const Module  = '/h3ml/sbin/server-hack-min.js';
const Version = '0.3.6.0'; // update this every time when edit the code!!!

import {Constants}   from "/h3ml/lib/constants.js";
import {Logger}      from "/h3ml/lib/log.js";
import {Servers}     from "/h3ml/lib/server-list.js";
import {Target}      from "/h3ml/lib/target-min.js";
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


const actionNone  = 0;
const actionGrow  = 1;
const actionHack  = 2;
const actionWeak  = 3;

const hackInitial = 0;
const hackPrepare = 1;
const hackBatch   = 2;

const protocolVersion = Constants.protocolVersion;
const ctrlPort = Constants.ctrlPort;

async function writeToPort(l, format, ...data) {
    const ns = l.ns;
    const str = ns.vsprintf(format, data);
    await ns.tryWritePort(ctrlPort, ns.sprintf("%d|%d|#|%s", Date.now(), protocolVersion, str));
    l.g(1, "%s", str);
}

function showInfo(l, table, server) {
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

        server.hackThreads,
        server.growThreads,
        server.weakThreads,
        [server.optimalHackMoney.amount, server.optimalHackMoney.unit],
        server.optimalThreads,
        Units.size(server.optimalThreads*botnet.workerRam*1024*1024).pretty(ns),
    );

    l.g(1, "%s", table.print());
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
            ["R"        , "%.2f"    ],  // rate to grow from available to max money
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
        ],
    );

    updateInfo(ns, server);
    showInfo(l, table, server);

    const gap_timeout = 500;

    // initial state
    while (server.availMoney.value !== server.maxMoney.value) {
        // grow and week batch;
        const gt = server.growMaxThreads;
        const gs = server.growSecurity;
        const ws = server.weakSecurityRate;
        const wt = Math.ceil(gt * gs / ws);

        const batch_time = Date.now();
        const batch_timeout = server.WeakTime.value;
        const grow_start = batch_time + batch_timeout*1000 - gap_timeout - server.growTime.value;

        await server["grow"](gt, {start: grow_start, batch: batch_time});
        await server["weak"](wt, {start: batch_time, batch: batch_time, await: true});
        updateInfo(ns, server);
        showInfo(l, table, server);
    }

    updateInfo(ns, server);
    showInfo(l, table, server);

    return;

    while (true) {

        const t = botnet.workers;

        if (t <= 0) {
            await writeToPort(l, "=> '%s' unable to do anything, not enough resource on botnet ", target);
            await ns.sleep(1000);
            botnet.update();
            server.hosts = botnet.servers;
            if (once == true) return;
            continue;
        }

        l.g(1, "%s analyze grow/hack on max threads %d", target, t);


        const availMoney = ns.getServerMoneyAvailable(target);
        const diffMoney = Units.money(availMoney - server.availMoney.value);
        const currentSecurity = ns.getServerSecurityLevel(target);

        switch (server.hackAction) {
                case actionGrow:
                    l.g(1, "<= '%s' grow +%s => %s", target, diffMoney.pretty(ns), Units.money(availMoney).pretty(ns));
                    break;
                case actionHack:
                    l.g(1, "<= '%s' hack -%s => %s", target, diffMoney.pretty(ns), Units.money(availMoney).pretty(ns));
                    break;
                case actionWeak:
                    l.g(1, "<= '%s' weak %.2f => %.2f", target, currentSecurity - server.currentSecurity, currentSecurity);
                    break;
        }

        server.preferAction = actionNone;
        l.g(1, "%s previous action %d, avail money availMoney %f, last %f", target, server.hackAction, availMoney, server.availMoney.value);
        if (server.hackAction == actionGrow || server.hackAction == actionHack) {
            // analize previous step result
            if (Math.floor(server.availMoney.value) == Math.floor(availMoney)) {
                await writeToPort(l, "=> '%s' previous action was ineffective, no avail money change, recommend to weak server", target);
                server.preferAction = actionWeak;
            }
        }

        updateInfo(ns, server);


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

            server.hackThreads,
            server.growThreads,
            server.weakThreads,
            [server.optimalHackMoney.amount, server.optimalHackMoney.unit],
            server.optimalThreads,
            Units.size(server.optimalThreads*botnet.workerRam*1024*1024).pretty(ns),
        );

        l.g(1, "%s", table.print());

        const wt = Math.min(server.weakThreads, t);
        const ws = wt * server.weakSecurityRate;

        if (server.preferAction == actionWeak && wt > 0 || server.currentSecurity >= 100) {
            l.g(1, "%s prefer weak, security %d", target, server.currentSecurity);

            //FIXME need write function to apply list of servers to do work
            //second this function must recalculate weak and growth threads for target hosts cpu
            await writeToPort(l, "=> '%s' weak << %d >> => -%.2f -> %d",
                target, wt, ws, server.currentSecurity - ws
            );
            server.hackAction = actionWeak;
            if (!analyze) await server["weaken"](wt, {await: true});
            await ns.sleep(1000); // just in case
            botnet.update();
            server.hosts = botnet.servers;
            if (once == true) return;
            continue
        }

        // a == m   => расчитываем hr на основе grow по max t
        // a >= m - m/gtr  оцениваем grow на основе max t нужно оценить кто больше принесет grow или hack
        // a < m - m/gtr

        // possible grow amount for t threads, naive method

        // prepare variables

        const a = server.availMoney.value; // avail money on server
        const m = server.maxMoney.value;   // max money on server

        const gr = server.moneyRatio;      // money ratio - possible 0, current
        const gt = server.growMaxThreads;  // current grow rate from a to m, possible 0 for a = m, and moneyRatio = 0

        const gmt = server.serverMaxGrowthThreads; // maximum grow threads
        const gmr = server.serverGrowth;           // server maximum grows rate
        const gma = m/gmr;                         // available money to grow for a to max

        l.d(1, "a %f m %f gr %f gt %f, gma %f, gmt %f", a, m, gr, gt, gma, gmt);

        // calc maximum growth on max(gmt,t);
        const [gpr, gpt] = calcGrowth(l, server, gma, gmr, gmt, t);
        const gpa = m/gpr;

        l.d(1, "gpa %f, gpt %d, gpr %f", gpa, gpt, gpr);
        l.d(1, "a  %f <= gma %f => near empty", a, gma);
        l.d(1, "a  %f >= m - gma %f => near full ", a, m - gma)
        l.d(1, "a  %f > gma %f || a %f < m - gma => need to grow", a, gma, a, m-gma);

        if (a <= gma) {
            l.g(1, "%s server near or empty", target);
            // could be there money of a is zero
            const gaf = Units.money(a*(gmr - 1));
            const gmf = Units.money(a*gmr);
            await writeToPort(l, "=> '%s' grow << %d >> => +%.2f%s -> %.2f%s",
                    target, gpt, gaf.amount, gaf.unit, gmf.amount, gmf.unit
            );
            server.hackAction = actionGrow;
            if (!analyze) await server["grow"](gpt, {await: true, growRate: gpr});
        }
        else if ( a >= m - gma) {
            l.g(1, "%s server full, a == m", target);

            // calculcate hack threads max(hmt|t)
            const hm = a*(1-1/gpr); // sometimes gt=0 when a nearest m but hm is > a
            const ht = Math.floor(ns.hackAnalyzeThreads(target, hm));

            const [hpm, hpt] = calcHack(l, server, hm, ht, t);
            const hma = Units.money(hpm);
            const sma = Units.money(m - hpm);

            await writeToPort(l, "=> '%s' hack << %d >> => -%.2f%s -> %.2f%s",
                target, hpt, hma.amount, hma.unit, sma.amount, sma.unit
            );
            server.hackAction = actionHack;
            if (!analyze) await server["hack"](hpt, {await: true});
        }
        // more complex a is more then grow amount to max, and hack anount will be more then grow amount
        else if ( a >= m - gma) {
            l.g(1, "%s server near full", target);

            // check hack money not toooo small
            const hm = a - gpa;
            const ht = Math.floor(ns.hackAnalyzeThreads(target, hm));
            const [hpm, hpt] = calcHack(l, server, hm, ht, t);

            const hma = Units.money(hpm);
            const sma = Units.money(a - hpm);

            //calculate growth threads from a to m for max(gt,t);
            const [ghr, ght] = calcGrowth(l, server, a, gr, gt, t);
            const gha = a * ghr;  // amount of money after grow
            l.d(1, "ghr %f, gha %f", ghr, gha);

            const gmf = Units.money(gha);
            const gaf = Units.money(gha-a);

            if ( hpm > m - a) {
                await writeToPort(l, "=> '%s' hack << %d >> => -%.2f%s -> %.2f%s",
                    target, hpt, hma.amount, hma.unit, sma.amount, sma.unit
                );
                server.hackAction = actionHack;
                if (!analyze) await server["hack"](hpt, {await: true});
            }
            else {
                await writeToPort(l, "=> '%s' grow << %d >> => +%.2f%s -> %.2f%s",
                    target, ght, gaf.amount, gaf.unit, gmf.amount, gmf.unit
                );
                server.hackAction = actionGrow;
                if (!analyze) await server["grow"](ght, {await: true, growRate: ghr});
            }
        }
        else {
            l.g(1, "%s server has a few money, grow and hack", target); // why not try to max?
            // here need understend grr is cut by max t or just a near m ?

            const [grr, grt] = calcGrowth(l, server, a, gr, gt, t);
            const gra = a * grr;    // a-gra/2 => hm
            l.d(1, "gra %f, grt %d, grr %f", gra, grt, grr);

            // нужно подсчитать сколько сможем взять что бы обеспечить при этом рост
            // a*grr столько будет денег после роста
            const hm = gr <= gmr ? a - gma : gra/2 - a;
            l.d(1, "hm %f, gr %f < gmr %f, a-gma %f, gra/2-a %f", hm, gr, gmr, a-gma, gra/2) - a;
            const ht = Math.floor(ns.hackAnalyzeThreads(target, hm));
            l.d(1, "ht %f", ht);
            const [hpm, hpt] = ht > 0 ? calcHack(l, server, hm, ht, t) : [0, 0];

            const hma = Units.money(hpm);
            const sma = Units.money(a - hpm);

            const gaf = Units.money(a*(grr - 1));
            const gmf = Units.money(a*grr);

            // first must grow, next must hack and repeat
            if (server.hackAction != actionGrow || ht == 0) {
                await writeToPort(l, "=> '%s' grow << %d >> => +%.2f%s -> %.2f%s",
                    target, grt, gaf.amount, gaf.unit, gmf.amount, gmf.unit
                );
            server.hackAction = actionGrow;
            if (!analyze) await server["grow"](grt, {await: true, growRate: grr});
            }
            else {
                await writeToPort(l, "=> '%s' hack << %d >> => -%.2f%s -> %.2f%s",
                    target, hpt, hma.amount, hma.unit, sma.amount, sma.unit
                );
                server.hackAction = actionHack;
                if (!analyze) await server["hack"](hpt, {await: true});
            }
        }

        if (once == true) return;
        await ns.sleep(1000);
        botnet.update();
        server.hosts = botnet.servers;
    }
}

/** @param {NS} ns **/
export async function main(ns) {
     const args = ns.flags([
        [ 'version'      , false ],
        [ 'update-port'  , 0     ],
        [ 'help'         , false ],
        [ 'log'          , 1     ], // log level - 0 quiet, 1 and more verbose
        [ 'debug'        , 1     ], // debug level
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
