// server-analyze.js
// version 0.1.10

/*
    experimetal code for analyze server stat to make hack strategy
    deprecated use server-hack targe --analyze
*/

import {Logger} from "log.js"
import {Server} from "lib-server-list.js"
import {BotNet} from "lib-botnet.js"
import {TableFormatter} from "lib-utils.js"

import {costFormat, timeFormat} from "lib-units.js"
import {updateInfo, calcGrowth, calcHack} from "lib-server-info-full.js"

const logLevel = 1;
const debugLevel = 1;


/** @param {NS} ns **/
export async function main(ns) {
    const [target, threads] = ns.args

    const lg = new Logger(ns, {logLevel: logLevel, debugLevel: debugLevel});

    if (!ns.serverExists(target)) {
        lg.lg(1, "server '%s' not found", target);
        return;
    }

    const host = ns.getHostname();
    const botnet = new BotNet(ns);

    // if max threads not defined calculate it
    const t = threads || botnet.workers;

    if (t == 0) {
        lg.lg(1, "server '%s' unable to do anything, not enough memory on host %s", target, host);
        return;
    }

    lg.lg(1, "server '%s' analyze grow/hack on max threads %d", target, t);

    const server = new Server(target);

    updateInfo(ns, server);

    const table = new TableFormatter(ns,
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


    const moneyHackRate = costFormat(server.threadRate);
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
        //scripts.has(server.name) ? "yes" : "no",
        server.hackMoney,
        server.hackThreads,
        //[server.hackAmount.cost, server.hackAmount.unit],
        server.growThreads,
        //[server.growAmount.cost, server.growAmount.unit],
        server.weakThreads,
        //server.weakAmount,
        server.optimalMaxThreads,
        [moneyHackRate.cost, moneyHackRate.unit]
    );

    table.print();

    // нужно разделить логику, поскольку код усложняется, разделить события

    // security = 100 hack chance лучше не смотреть, но если предыдущая операция hack/grow value = 0 то тоже начать

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

    lg.lg(1, "chances %f", server.analyzeChance);
    const wt = Math.min(server.weakThreads, t);
    const ws = wt * server.weakSecurityRate;

    if (server.analyzeChance < 0.01) {
        lg.lg(1, "%s weak threads << %d >> security -%.2f -> %d in %.2f%s",
            target, wt, ws, server.currentSecurity - ws, server.weakTime.time, server.weakTime.unit
        );
        return;
    }

    lg.ld(1, "a %f m %f gr %f gt %f", a, m, gr, gt);
    // calc maximum growth on max(gmt,t);
    const [gpr, gpt] = calcGrowth(lg, server, gma, gmr, gmt, t);
    const gpa = m/gpr;
    lg.ld(1, "gpa %f, gnt %d, gpr %f", gpa, gpt, gpr);


    if (a == m || gt == 0) {
        lg.ld(1, "server full, a == m");

        // calculcate hack threads max(hmt|t)
        const hm = m - gpa;
        const ht = Math.floor(ns.hackAnalyzeThreads(target, hm));
        lg.lg(1, "hm %f, ht %d", hm, ht);

        const [hpm, hpt] = calcHack(lg, server, hm, ht, t);
        const hma = costFormat(hpm);
        const sma = costFormat(m - hpm);

        if (
                server.minSecurity + server.hackSecurity * hpt > 100
                ||
                server.weakThreads > t
        ) {
            lg.lg(1, "%s weak threads << %d >> security -%.2f -> %d in %.2f%s",
                target, wt, ws, server.currentSecurity - ws, server.weakTime.time, server.weakTime.unit
            );
        }
        else {
            lg.lg(1, "hack threads << %d >> money -%.2f%s => %.2f%s in %.2f%s",
                hpt, hma.cost, hma.unit, sma.cost, sma.unit, server.hackTime.time, server.hackTime.unit
            );
        }
    }
    else if (a >= m/gr && a > gpa) {
        lg.ld(1, "server near full");

        //calculate hack threads to stole a - gpa max(ht|t)
        const hm = a - gpa;
        const ht = Math.floor(ns.hackAnalyzeThreads(target, hm));
        lg.lg(1, "hm %f, ht %d", hm, ht);
        const [hpm, hpt] = calcHack(lg, server, hm, ht, t);

        const hma = costFormat(hpm);
        const sma = costFormat(a - hpm);

        //calculate growth threads from a to m for max(gt,t);
        const [ghr, ght] = calcGrowth(lg, server, a, gr, gt, t);
        const gha = a * ghr;  // amount of money after grow

        const gaf = costFormat(gha*(ghr - 1));
        const gmf = costFormat(gha*ghr);

        if (
            server.minSecurity + Math.max(server.hackSecurity * hpt, server.growSecurity * ght) > 100
            ||
            server.weakThreads > t
        ){
            lg.lg(1, "%s weak threads << %d >> security -%.2f -> %d in %.2f%s",
                target, wt, ws, server.currentSecurity - ws, server.weakTime.time, server.weakTime.unit
            );
        }
        else if ( hpm > m - a) {
            lg.lg(1, "hack threads << %d >> money -%.2f%s => %.2f%s in %.2f%s",
                hpt, hma.cost, hma.unit, sma.cost, sma.unit, server.hackTime.time, server.hackTime.unit
            );
        }
        else {
            lg.lg(1, "grow threads << %d >> money %.2f%s => %.2f%s in %.2f%s",
                ght, gaf.cost, gaf.unit, gmf.cost, gmf.unit, server.hackTime.time, server.hackTime.unit
            );
        }
    }
    else {
        lg.ld(1, "server has a few money, need grow");

        const [grr, grt] = calcGrowth(lg, server, a, gr, gt, t);
        const gra = a * grr;
        lg.ld(1, "gra %f, grt %d, grr %f", gra, grt, grr);

        // нужно подсчитать сколько сможем взять что бы обеспечить при этом рост
        // a*grr столько будет денег после роста
        const hm = (a - a/grr) * 0.5;
        const ht = Math.floor(ns.hackAnalyzeThreads(target, hm));
        const [hpm, hpt] = calcHack(lg, server, hm, ht, t);

        const hma = costFormat(hpm);
        const sma = costFormat(a - hpm);

        const gaf = costFormat(gra*(grr - 1));
        const gmf = costFormat(gra*grr);

        if (
            server.minSecurity + Math.max(server.hackSecurity * hpt, server.growSecurity * grt) > 100
            ||
            server.weakThreads > t
        ){
            lg.lg(1, "%s weak threads << %d >> security -%.2f -> %d in %.2f%s",
                target, wt, ws, server.currentSecurity - ws, server.weakTime.time, server.weakTime.unit
            );
        }
        else {
            // first must grow, next must hack and repeat

            lg.lg(1, "hack threads << %d >> money -%.2f%s => %.2f%s in %.2f%s",
                hpt, hma.cost, hma.unit, sma.cost, sma.unit, server.hackTime.time, server.hackTime.unit
            );
            lg.lg(1, "grow threads << %d >> money %.2f%s => %.2f%s in %.2f%s",
                grt, gaf.cost, gaf.unit, gmf.cost, gmf.unit, server.hackTime.time, server.hackTime.unit
            );
        }

    }

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
