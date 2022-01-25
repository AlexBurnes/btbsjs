// server-hack.js
// version 0.1.10

import {Logger} from "log.js"
import {Target} from "lib-target.js"
import {Server} from "lib-server-list.js"
import {BotNet} from "lib-botnet.js"
import {TableFormatter} from "lib-utils.js"
import {costFormat} from "lib-units.js"
import {updateInfo, calcGrowth, calcHack} from "lib-server-info-full.js"

const actionNone = 0;
const actionGrow = 1;
const actionHack = 2;
const actionWeak = 3;
const protocolVersion = 2;

async function writeToPort(lg, port, format, ...data) {
    const ns = lg.ns;
    const str = ns.vsprintf(format, data);
    if (port > 0) {
        await ns.tryWritePort(1, ns.sprintf("%d|%d|#|%s", Date.now(), protocolVersion, str));
    }
    else {
        lg.log(1, "%s", str);
    }
}

async function hackServer(lg, target, once, analyze, port) {
    const ns = lg.ns;

    const host = ns.getHostname();
    const botnet = new BotNet(ns);
    const server = new Target(lg, target, botnet.servers);

    server.hackAction = actionNone;
    server.preferAction = actionNone;
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

    while (true) {

        const t = botnet.workers;

        if (t == 0) {
            await writeToPort(lg, port, "=> '%s' unable to do anything, not enough resource on botnet ", target);
            await ns.sleep(1000);
            botnet.update();
            server.hosts = botnet.servers;
            if (once == true) return;
            continue;
        }

        lg.log(2, "%s analyze grow/hack on max threads %d", target, t);

        const availMoney = ns.getServerMoneyAvailable(target);
        lg.log(2, "%s previous action %d, avail money availMoney %f, last %f", target, server.hackAction, availMoney, server.availMoney.value);
        if (server.hackAction == actionGrow || server.hackAction == actionHack) {
            // analize previous step result
            if (Math.floor(server.availMoney.value) == Math.floor(availMoney)) {
                await writeToPort(lg, port, "=> '%s' previous action was ineffective, no avail money change, recommend to weak server", target);
                server.preferAction = actionWeak;
            }
            else {
                server.preferAction = actionNone; // analyze what to do
            }

        }

        updateInfo(ns, server);


        const moneyHackRate = costFormat(server.threadRate);
        if (lg.logLevel > 1) table.push(
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

        if (lg.logLevel > 1) table.print();

        const server_info = ns.sprintf(
            "ch %.2f, sec %.2f/%.2f, a %.2f%s m %.2f%s, r %.2f, ht %.2f%s, gt %.2f%s, wt %.2f%s",
            100 * server.analyzeChance, server.minSecurity, server.currentSecurity,
            server.availMoney.cost, server.availMoney.unit, server.maxMoney.cost, server.maxMoney.unit,
            server.moneyRatio, server.hackTime.time, server.hackTime.unit,
            server.growTime.time, server.growTime.unit, server.weakTime.time, server.weakTime.unit,
        );

        const wt = Math.min(server.weakThreads, t);
        const ws = wt * server.weakSecurityRate;

        if (server.analyzeChance < 0.01 && wt == 0) {
            await writeToPort(lg, port, "=> '%s' unable to hack server, chances %.2%f too low, and weak security unable to down",
                target, 100*server.analyzeChance
            );
            await ns.sleep(1000); // just in case
            botnet.update();
            server.hosts = botnet.servers;
            if (once == true) return;
            continue;
        }

        if (server.preferAction == actionWeak && wt > 0 || server.analyzeChance < 0.01) {
            lg.log(2, "%s prefer weak, chances %.2f", target, 100*server.analyzeChance);

            //FIXME need write function to apply list of servers to do work
            //second this function must recalculate weak and growth threads for target hosts cpu
            await writeToPort(lg, port, "=> '%s' weak << %d >> %.2f%s => -%.2f -> %d",
                target, wt, server.weakTime.time, server.weakTime.unit, ws, server.currentSecurity - ws
            );
            server.hackAction = actionWeak;
            if (!analyze) await server.weaken(wt, {await: true});
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

        lg.debug(1, "a %f m %f gr %f gt %f", a, m, gr, gt);

        // calc maximum growth on max(gmt,t);
        const [gpr, gpt] = calcGrowth(lg, server, gma, gmr, gmt, t);
        const gpa = m/gpr;
        lg.debug(1, "gpa %f, gnt %d, gpr %f", gpa, gpt, gpr);
        lg.debug(1, "gr %f >= gmr %f || gr == 0 => near empty", gr, gmr);
        lg.debug(1, "a %f == m %f || (gr < 1.01 && gr > 1.00) %f => full ", a, m, gr)
        lg.debug(1, "a %f >= m/gmr %f && a > gpa %f && a - gpa %f > m - gpa %f => near full", a, m/gmr, gpa, a-gpa, m-gpa);

        if (gr >= gmr || gr == 0) {
            lg.log(2, "%s server near or empty", target);
            // could be there money of a is zero
            const gaf = costFormat(a*(gmr - 1));
            const gmf = costFormat(a*gmr);
            if (
                server.minSecurity + server.growSecurity * gpt > 100
                ||
                server.weakThreads > t
            ){
                await writeToPort(lg, port, "=> '%s' weak << %d >> %.2f%s => -%.2f -> %d",
                    target, wt, server.weakTime.time, server.weakTime.unit, ws, server.currentSecurity - ws
                );
                server.hackAction = actionWeak;
                if (!analyze) await server.weaken(wt, {await: true});
            }
            else {
                await writeToPort(lg, port, "=> '%s' grow << %d >> %.2f%s => +%.2f%s -> %.2f%s",
                    target, gpt, server.hackTime.time, server.hackTime.unit, gaf.cost, gaf.unit, gmf.cost, gmf.unit
                );
                server.hackAction = actionGrow;
                if (!analyze) await server.grow(gpt, {await: true, growRate: gpr});
            }
        }
        else if (a == m || (gr < 1.01 && gr > 1.00) || gt == 0) {
            lg.log(2, "%s server full, a == m", target);

            // calculcate hack threads max(hmt|t)
            const hm = a*(1-1/gpr); // sometimes gt=0 when a nearest m but hm is > a
            const ht = Math.floor(ns.hackAnalyzeThreads(target, hm));

            const [hpm, hpt] = calcHack(lg, server, hm, ht, t);
            const hma = costFormat(hpm);
            const sma = costFormat(m - hpm);

            if (
                    server.minSecurity + server.hackSecurity * hpt > 100
                    ||
                    server.weakThreads > t
            ) {
                await writeToPort(lg, port, "=> '%s' weak << %d >> %.2f%s => -%.2f -> %.2f ",
                    target, wt, server.weakTime.time, server.weakTime.unit, ws, server.currentSecurity - ws
                );
                server.hackAction = actionWeak;
                if (!analyze) await server.weaken(wt, {await: true});
            }
            else {
                await writeToPort(lg, port, "=> '%s' hack << %d >> %.2f%s => -%.2f%s -> %.2f%s",
                    target, hpt, server.hackTime.time, server.hackTime.unit, hma.cost, hma.unit, sma.cost, sma.unit
                );
                server.hackAction = actionHack;
                if (!analyze) await server.hack(hpt, {await: true});
            }
        }
        // more complex a is more then grow amount to max, and hack anount will be more then grow amount
        else if (a >= m/gmr && a > gpa && a - gpa > m - gpa) {
            lg.log(2, "%s server near full", target);

            // check hack money not toooo small
            const hm = a - gpa;
            const ht = Math.floor(ns.hackAnalyzeThreads(target, hm));
            const [hpm, hpt] = calcHack(lg, server, hm, ht, t);

            const hma = costFormat(hpm);
            const sma = costFormat(a - hpm);

            //calculate growth threads from a to m for max(gt,t);
            const [ghr, ght] = calcGrowth(lg, server, a, gr, gt, t);
            const gha = a * ghr;  // amount of money after grow
            lg.debug(1, "ghr %f, gha %f", ghr, gha);

            const gmf = costFormat(gha);
            const gaf = costFormat(gha-a);

            if (
                server.minSecurity + Math.max(server.hackSecurity * hpt, server.growSecurity * ght) > 100
                ||
                server.weakThreads > t
            ){
                await writeToPort(lg, port, "=> '%s' weak << %d >> %.2f%s => -%.2f -> %.2f",
                    target, wt, server.weakTime.time, server.weakTime.unit, ws, server.currentSecurity - ws
                );
                server.hackAction = actionWeak;
                if (!analyze) await server.weaken(wt, {await: true});
            }
            else if ( hpm > m - a) {
                await writeToPort(lg, port, "=> '%s' hack << %d >> %.2f%s => -%.2f%s -> %.2f%s",
                    target, hpt, server.hackTime.time, server.hackTime.unit, hma.cost, hma.unit, sma.cost, sma.unit
                );
                server.hackAction = actionHack;
                if (!analyze) await server.hack(hpt, {await: true});
            }
            else {
                await writeToPort(lg, port, "=> '%s' grow << %d >> %.2f%s => +%.2f%s -> %.2f%s",
                    target, ght, server.hackTime.time, server.hackTime.unit, gaf.cost, gaf.unit, gmf.cost, gmf.unit
                );
                server.hackAction = actionGrow;
                if (!analyze) await server.grow(ght, {await: true, growRate: ghr});
            }
        }
        else {
            lg.log(2, "%s server has a few money, grow and hack", target); // why not try to max?
            const [grr, grt] = calcGrowth(lg, server, a, gr, gt, t);
            const gra = a * grr;
            lg.debug(1, "gra %f, grt %d, grr %f", gra, grt, grr);

            // нужно подсчитать сколько сможем взять что бы обеспечить при этом рост
            // a*grr столько будет денег после роста
            const hm = (a - a/grr) * 0.5;
            const ht = a/m > 0.1 ? Math.floor(ns.hackAnalyzeThreads(target, hm)) : 0;
            const [hpm, hpt] = ht > 0 ? calcHack(lg, server, hm, ht, t) : [hm, ht];

            const hma = costFormat(hpm);
            const sma = costFormat(a - hpm);

            const gaf = costFormat(a*(grr - 1));
            const gmf = costFormat(a*grr);

            if (
                server.minSecurity + Math.max(server.hackSecurity * hpt, server.growSecurity * grt) > 100
                ||
                server.weakThreads > t
            ){
                await writeToPort(lg, port, "=> '%s' weak << %d >> %.2f%s => -%.2f -> %d",
                    target, wt, server.weakTime.time, server.weakTime.unit, server.currentSecurity - server.minSecurity, server.minSecurity
                );
                server.hackAction = actionWeak;
                if (!analyze) await server.weaken(wt, {await: true});
            }
            else {
                // first must grow, next must hack and repeat
                if (server.hackAction != actionGrow ) {
                    await writeToPort(lg, port, "=> '%s' grow << %d >> %.2f%s => +%.2f%s -> %.2f%s",
                        target, grt, server.hackTime.time, server.hackTime.unit, gaf.cost, gaf.unit, gmf.cost, gmf.unit
                    );
                    server.hackAction = actionGrow;
                    if (!analyze) await server.grow(grt, {await: true, growRate: grr});
                }
                else {
                    await writeToPort(lg, port, "=> '%s' hack << %d >> %.2f%s => -%.2f%s -> %.2f%s",
                        target, hpt, server.hackTime.time, server.hackTime.unit, hma.cost, hma.unit, sma.cost, sma.unit
                    );
                    server.hackAction = actionHack;
                    if (!analyze) await server.hack(hpt, {await: true});
                }
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
     const data = ns.flags([
        ['debug'    , false],
        ['once'     , false],
        ['analyze'  , false]
    ]);
    const server = data["_"][0];

    const debugMode    = data["debug"]   ? 1 : 0;
    const analyzeOnly  = data["analyze"] ? 1 : 0;
    const runOnce      = data["once"]    ? 1 : 0;
    const outputToPort = debugMode       ? 0 : 1;

    const lg = new Logger(ns, {logLevel: debugMode ? 2 : 1, debugLevel: debugMode ? 1 : 0});

    if (!ns.serverExists(server)) {
        lg.log(1, "server %s do not exists", server);
        return;
    }

    await hackServer(lg, server, runOnce, analyzeOnly, outputToPort);

    if (runOnce) lg.log(1, "server-hack done target %s", server);

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
