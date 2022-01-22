// server-analyze.js
// version 0.1.0

/*
    experimetal code for analyze server stat to make hack strategy
*/

import {Logger} from "log.js"
import {Server} from "lib-server-list.js"
import {costFormat, timeFormat} from "lib-units.js"
import {TableFormatter} from "lib-utils.js"
import {updateInfo} from "lib-server-info-full.js"

/** @param {NS} ns **/
export async function main(ns) {
    const [target, threads] = ns.args

    const lg = new Logger(ns);

    if (!ns.serverExists(target)) {
    lg.log(1, "server '%s' not found", target);
    return;
    }

    const host = ns.getHostname();

    // if max threads not defined calculate it
    const t = threads || Math.floor(ns.getServerMaxRam(host) - ns.getServerUsedRam(host))/ns.getScriptRam("worker.js");

    if (t == 0) {
    lg.log(1, "server '%s' unable to do anything, not enough memory on host %s", target, host);
    return;
    }

    lg.log(1, "server '%s' analyze grow/hack on max threads %d", target, t);

    const server = new Server(target);

    const table = new TableFormatter(ns,
        ["    Name", "Chance", "Min ", "Cur",  "Avail",  "Max",    "Ratio", "Hack",   "Grow",   "Weak",   "Hack r", "Grow r", "Hack Th", "Hack $", "Grow Th", "Grow $", "Weak Th", "Sec Down"],
        ["    %s ",  "%.2f%%", "%.2f", "%.2f", "%.2f%s", "%.2f%s", "%.5f",  "%.2f%s", "%.2f%s", "%.2f%s", "%.8f",   "%d",     "%d",      "%.2f%s", "%d",      "%.2f%s", "%d",      "%.2f"         ]
    );
    // sort by hacking chance descending
    //servers.sort(function(a, b){return ns.hackAnalyzeChance(b.name) - ns.hackAnalyzeChance(a.name)});

    // sort by hackin level ascending
    updateInfo(ns, server);
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
        server.hackMoney,
        server.serverGrowth,
        server.hackThreads,
        [ server.hackAmount.cost, server.hackAmount.unit ],
        server.growThreads,
        [ server.growAmount.cost, server.growAmount.unit ],
        server.weakThreads,
        server.weakAmount
    );

    table.print();
    //считаем что это максимальный рост который возможен у сервера
    const serverGrowthThreads = server.serverMaxGrouthThreads;
    lg.log(1, "server growth effect %d threads %d", server.serverGrowth, serverGrowthThreads);

    // server grow rate threads, if unknown get max grow rate threads
    let gt = server.growMaxThreads || serverGrowthThreads;

    let a = server.availMoney.value;
    let m = server.maxMoney.value;
    let nr = server.moneyRatio;

    // possible grow rate for t threads from max server growth
    const gtr = server.serverGrowth * (Math.min(t, gt) / serverGrowthThreads);
    // possible grow amount for t threads when maximum money
    const gta = m - m / gtr;

    // maximum hack threads
    let ht = Math.min(t, server.hackThreads);

    lg.log(1, "m %f a %f a > (m - gta) %f", m, a, (m - gta));
    if (a > m - gta) {
        a = m - gta;
        nr = gtr;
    }

    lg.log(1, "a %f m %f t %d gt %d nr %f", a, m, t, gt, nr);

    let i = 1;
    let na = a;

    while (gt > t) {
    if (++i > 10 ) break; // обычно хватает нескольких итераций
    const tr = gt/t; // на сколько нужно уменьшить
    na = a + (m - a) / tr;
    nr = na/a;
    lg.log(1, "gt %d t %d tr %f, a %d m %d na %d nr %f", gt, t, tr, a, m, na, nr);
    gt = Math.ceil(ns.growthAnalyze(target, nr));
    m = a * nr;
    lg.log(1, "thread grow ratio %f threads %d", nr, gt);
    }

    const ga = costFormat(a * nr - a);
    // когда сервер полный, то будет 0 0,
    lg.log(1, "after grow on << %d >> threads money grow will be %.2f%s", gt, ga.cost, ga.unit);

    a = server.availMoney.value;

    // пока это нам ничего не дает, кроме как ответ на вопрос growfactor nr
    // вопрос сколько денег можно взять
    //hm * nr = a; hm = a/nr; ha = a - a/nr; ha = a*(1-1/nr);
    let hm = costFormat(a*(1-1/nr));
    ht = Math.floor(ns.hackAnalyzeThreads(target, hm.value));
    lg.log(1, "max money hack %.2f%s threads %d", hm.cost, hm.unit, ht);

    // ok это если сервер не должен расти, а если должен?, а вот и ответ собственно на вопрос когда денег много

    // a это формула роста
    let sr = nr - (nr - 1)*0.5; // уменьшаем в два раза, а как уменьшить на 50%  a - (a - 1)*0.5
    let sm = costFormat(a*(1-1/sr));
    let st = Math.floor(ns.hackAnalyzeThreads(target, sm.value));

    // так погоди если у нас gt > t, то мы должны и hack ограничить этим t значением
    if (st > t) {
    st = t;
    sr = 1/(1 - server.hackMoney * st); //a/(a - a * hackMoney * t);
    sm = costFormat(a*(1-1/sr));
    st = Math.floor(ns.hackAnalyzeThreads(target, sm.value)); // проверка
    }

    lg.log(1, "max money nr %f sr %f hack %.2f%s threads << %d >>", nr, sr, sm.cost, sm.unit, st);

    lg.log(1, "weak threads << %d >>", server.weakThreads);

    // if weak > t do weak
    // if a == m do hack
    // else do grow and then hack
    // if grow or hack operation is fault value = 0 then do week

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
