const Module  = '/h3ml/sbin/server-hack.js';
const Version = '0.3.4.12'; // update this every time when edit the code!!!

import {Constants}   from "/h3ml/lib/constants.js";
import {Logger}      from "/h3ml/lib/log.js";
import {Target}      from "/h3ml/lib/target.js";
import {Server}      from "/h3ml/lib/server-list.js";
import {BotNet}      from "/h3ml/lib/botnet.js";
import {Table}       from "/h3ml/lib/utils.js";
import {moneyFormat} from "/h3ml/lib/units.js";
import {updateInfo, calcGrowth, calcHack} from "/h3ml/lib/server-info.js";

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


const actionNone = 0;
const actionGrow = 1;
const actionHack = 2;
const actionWeak = 3;
const protocolVersion = Constants.protocolVersion;
const ctrlPort = Constants.ctrlPort;

async function writeToPort(l, port, format, ...data) {
    const ns = l.ns;
    const str = ns.vsprintf(format, data);
    if (port > 0) {
        await ns.tryWritePort(ctrlPort, ns.sprintf("%d|%d|#|%s", Date.now(), protocolVersion, str));
    }
    else {
        l.g(1, "%s", str);
    }
}

async function hackServer(l, target, once, analyze, port) {
    const ns = l.ns;

    const host = ns.getHostname();
    const botnet = new BotNet(ns);
    const server = new Target(l, target, botnet.servers);

    server.hackAction = actionNone;
    server.preferAction = actionNone;
    updateInfo(ns, server);

    const table = new Table(ns,
        [
            ["    Name" , "%s"      ],  // server name
            ["Chance"   , "%.2f%%"  ],  // hack  chance
            ["Min "     , "%.2f"    ],  // min sucity
            ["Cur"      , "%.2f"    ],  // cure: security
            ["Avail"    , "%.2f%s"  ],  // available money
            ["Max"      , "%.2f%s"  ],  // max money
            ["R"        , "%.2f"    ],  // rate to grow from available to max money
            ["Gr"       , "%d"      ],  // server growth effectivness
            ["Htm"      , "%.2f%s"  ],  // hack time
            ["Gtm"      , "%.2f%s"  ],  // grow time
            ["Wtm"      , "%.2f%s"  ],  // weaken time
            ["Hp"       , "%.8f"    ],  // hack money part
            ["Hth"      , "%d"      ],  // hack threads to hack all avail money
            //["Hm"       , "%.2f%s"  ],  // hack money with Hth threads
            ["Gth"      , "%d"      ],  // grow threads to grow from avail to max money
            //["Gm"       , "%.2f%s"  ],  // grow money with Gth threads
            ["Wth"      , "%d"      ],  // weaken threads to down security to minimum
            //["Ws"       , "%.2f"    ],  // weaken security level with Wth
            ["Max Oth"  , "%d"      ],  // maximum optimal threads required for server
            ["Cr"       , "%.2f%s"  ],  // cicle rate, cycle = n(grow+hack)+weak
        ],
    );

    while (true) {

        const t = botnet.workers;

        if (t == 0) {
            await writeToPort(l, port, "=> '%s' unable to do anything, not enough resource on botnet ", target);
            await ns.sleep(1000);
            botnet.update();
            server.hosts = botnet.servers;
            if (once == true) return;
            continue;
        }

        l.g(2, "%s analyze grow/hack on max threads %d", target, t);

        const availMoney = ns.getServerMoneyAvailable(target);
        l.g(2, "%s previous action %d, avail money availMoney %f, last %f", target, server.hackAction, availMoney, server.availMoney.value);
        if (server.hackAction == actionGrow || server.hackAction == actionHack) {
            // analize previous step result
            if (Math.floor(server.availMoney.value) == Math.floor(availMoney)) {
                await writeToPort(l, port, "=> '%s' previous action was ineffective, no avail money change, recommend to weak server", target);
                server.preferAction = actionWeak;
            }
            else {
                server.preferAction = actionNone; // analyze what to do
            }

        }

        updateInfo(ns, server);


        const moneyHackRate = moneyFormat(server.threadRate);
        if (l.logLevel > 1) table.push(
            server.name,
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
            //scripts.has(server.name) ? "yes" : "no",
            server.hackMoney,
            server.hackThreads,
            //[server.hackAmount.amount, server.hackAmount.unit],
            server.growThreads,
            //[server.growAmount.amount, server.growAmount.unit],
            server.weakThreads,
            //server.weakAmount,
            server.optimalMaxThreads,
            [moneyHackRate.amount, moneyHackRate.unit]
        );

        if (l.logLevel > 1) table.print();

        const server_info = ns.sprintf(
            "ch %.2f, sec %.2f/%.2f, a %.2f%s m %.2f%s, r %.2f, ht %.2f%s, gt %.2f%s, wt %.2f%s",
            100 * server.hackChances, server.minSecurity, server.currentSecurity,
            server.availMoney.amount, server.availMoney.unit, server.maxMoney.amount, server.maxMoney.unit,
            server.moneyRatio, server.hackTime.time, server.hackTime.unit,
            server.growTime.time, server.growTime.unit, server.weakTime.time, server.weakTime.unit,
        );

        const wt = Math.min(server.weakThreads, t);
        const ws = wt * server.weakSecurityRate;

        if (server.hackChances < 0.01 && wt == 0) {
            await writeToPort(l, port, "=> '%s' unable to hack server, chances %.2%f too low, and weak security unable to down",
                target, 100*server.hackChances
            );
            await ns.sleep(1000); // just in case
            botnet.update();
            server.hosts = botnet.servers;
            if (once == true) return;
            continue;
        }

        if (server.preferAction == actionWeak && wt > 0 || server.hackChances < 0.01 || server.currentSecurity >= 100) {
            l.g(2, "%s prefer weak, chances %.2f", target, 100*server.hackChances);

            //FIXME need write function to apply list of servers to do work
            //second this function must recalculate weak and growth threads for target hosts cpu
            await writeToPort(l, port, "=> '%s' weak << %d >> %.2f%s => -%.2f -> %d",
                target, wt, server.weakTime.time, server.weakTime.unit, ws, server.currentSecurity - ws
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

        l.d(1, "a %f m %f gr %f gt %f", a, m, gr, gt);

        // calc maximum growth on max(gmt,t);
        const [gpr, gpt] = calcGrowth(l, server, gma, gmr, gmt, t);
        const gpa = m/gpr;
        l.d(1, "gpa %f, gpt %d, gpr %f", gpa, gpt, gpr);
        l.d(1, "gr %f >= gmr %f || gr == 0 => near empty", gr, gmr);
        l.d(1, "a %f == m %f || (gr < 1.01 && gr > 1.00) %f => full ", a, m, gr)
        l.d(1, "a %f >= m/gmr %f && a > gpa %f && a - gpa %f > m - gpa %f => near full", a, m/gmr, gpa, a-gpa, m-gpa);

        if (gr >= gmr || gr == 0) {
            l.g(2, "%s server near or empty", target);
            // could be there money of a is zero
            const gaf = moneyFormat(a*(gmr - 1));
            const gmf = moneyFormat(a*gmr);
            await writeToPort(l, port, "=> '%s' grow << %d >> %.2f%s => +%.2f%s -> %.2f%s",
                    target, gpt, server.hackTime.time, server.hackTime.unit, gaf.amount, gaf.unit, gmf.amount, gmf.unit
            );
            server.hackAction = actionGrow;
            if (!analyze) await server["grow"](gpt, {await: true, growRate: gpr});
        }
        else if (a == m || (gr < 1.01 && gr > 1.00) || gt == 0) {
            l.g(2, "%s server full, a == m", target);

            // calculcate hack threads max(hmt|t)
            const hm = a*(1-1/gpr); // sometimes gt=0 when a nearest m but hm is > a
            const ht = Math.floor(ns.hackAnalyzeThreads(target, hm));

            const [hpm, hpt] = calcHack(l, server, hm, ht, t);
            const hma = moneyFormat(hpm);
            const sma = moneyFormat(m - hpm);

            await writeToPort(l, port, "=> '%s' hack << %d >> %.2f%s => -%.2f%s -> %.2f%s",
                target, hpt, server.hackTime.time, server.hackTime.unit, hma.amount, hma.unit, sma.amount, sma.unit
            );
            server.hackAction = actionHack;
            if (!analyze) await server["hack"](hpt, {await: true});
        }
        // more complex a is more then grow amount to max, and hack anount will be more then grow amount
        else if (a >= m/gmr && a > gpa && a - gpa > m - gpa) {
            l.g(2, "%s server near full", target);

            // check hack money not toooo small
            const hm = a - gpa;
            const ht = Math.floor(ns.hackAnalyzeThreads(target, hm));
            const [hpm, hpt] = calcHack(l, server, hm, ht, t);

            const hma = moneyFormat(hpm);
            const sma = moneyFormat(a - hpm);

            //calculate growth threads from a to m for max(gt,t);
            const [ghr, ght] = calcGrowth(l, server, a, gr, gt, t);
            const gha = a * ghr;  // amount of money after grow
            l.d(1, "ghr %f, gha %f", ghr, gha);

            const gmf = moneyFormat(gha);
            const gaf = moneyFormat(gha-a);

            if ( hpm > m - a) {
                await writeToPort(l, port, "=> '%s' hack << %d >> %.2f%s => -%.2f%s -> %.2f%s",
                    target, hpt, server.hackTime.time, server.hackTime.unit, hma.amount, hma.unit, sma.amount, sma.unit
                );
                server.hackAction = actionHack;
                if (!analyze) await server["hack"](hpt, {await: true});
            }
            else {
                await writeToPort(l, port, "=> '%s' grow << %d >> %.2f%s => +%.2f%s -> %.2f%s",
                    target, ght, server.hackTime.time, server.hackTime.unit, gaf.amount, gaf.unit, gmf.amount, gmf.unit
                );
                server.hackAction = actionGrow;
                if (!analyze) await server["grow"](ght, {await: true, growRate: ghr});
            }
        }
        else {
            l.g(2, "%s server has a few money, grow and hack", target); // why not try to max?
            const [grr, grt] = calcGrowth(l, server, a, gr, gt, t);
            const gra = a * grr;
            l.d(1, "gra %f, grt %d, grr %f", gra, grt, grr);

            // нужно подсчитать сколько сможем взять что бы обеспечить при этом рост
            // a*grr столько будет денег после роста
            const hm = (a - a/grr) * 0.5;
            const ht = a/m > 0.1 ? Math.floor(ns.hackAnalyzeThreads(target, hm)) : 0;
            const [hpm, hpt] = ht > 0 ? calcHack(l, server, hm, ht, t) : [hm, ht];

            const hma = moneyFormat(hpm);
            const sma = moneyFormat(a - hpm);

            const gaf = moneyFormat(a*(grr - 1));
            const gmf = moneyFormat(a*grr);

            // first must grow, next must hack and repeat
            if (server.hackAction != actionGrow ) {
                await writeToPort(l, port, "=> '%s' grow << %d >> %.2f%s => +%.2f%s -> %.2f%s",
                    target, grt, server.hackTime.time, server.hackTime.unit, gaf.amount, gaf.unit, gmf.amount, gmf.unit
                );
            server.hackAction = actionGrow;
            if (!analyze) await server["grow"](grt, {await: true, growRate: grr});
            }
            else {
                await writeToPort(l, port, "=> '%s' hack << %d >> %.2f%s => -%.2f%s -> %.2f%s",
                    target, hpt, server.hackTime.time, server.hackTime.unit, hma.amount, hma.unit, sma.amount, sma.unit
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
        [ 'debug'        , 0     ], // debug level
        [ 'verbose'      , true  ], // verbose mode, short analog of --log-level 1
        [ 'quiet'        , false ], // quiet mode, short analog of --log-level 0
        [ 'once'         , false ],
        [ 'analyze'      , false ]

    ]);

    if (args['version']) {
        return version(ns, args['update-port']);
    }
    if (args['help']) {
        return help(ns);
    }

    // for modules
    const l = new Logger(ns, {args: args});



    const server = args["_"][0];

    const debugMode    = args["debug"]   ? 1 : 0;
    const analyzeOnly  = args["analyze"] ? 1 : 0;
    const runOnce      = args["once"]    ? 1 : 0;
    const outputToPort = debugMode       ? 0 : 1;

    if (!ns.serverExists(server)) {
        l.g(1, "server %s do not exists", server);
        return;
    }

    await hackServer(l, server, runOnce, analyzeOnly, outputToPort);

    if (runOnce) l.g(1, "server-hack done target %s", server);

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
