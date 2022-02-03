const Module  = '/h3ml/lib/server-info.js';
const Version = '0.3.4.12'; // update this every time when edit the code!!!

import {Constants}  from "/h3ml/lib/constants.js";
import {Units}      from "/h3ml/lib/units.js"

/** @param {NS} ns
 *  @param {Target||Server} target
**/
export function updateInfo(ns, target) {

    //FIXME use h3ml/ect/servers instead
    // find another way to prepare this information
    // like server.json
    const server = ns.getServer(target.name); // 2G usage, must expensive function here
    target.serverGrowth = server.serverGrowth;

    //FIXME this information need gather before, for different, but if this information is player depended?
    target.weakSecurityRate = ns.weakenAnalyze(1);
    target.hackSecurity = ns.hackAnalyzeSecurity(1);    // security grow on hack by one thread
    target.growSecurity = ns.growthAnalyzeSecurity(1);  // security groe on hack by one thread

    target.serverMaxGrowthThreads = server.serverGrowth > 1 ? Math.ceil(ns.growthAnalyze(target.name, server.serverGrowth)) : 0;

    //target.minSecurity      = ns.getServerMinSecurityLevel(target.name);
    //target.currentSecurity  = ns.getServerSecurityLevel(target.name);

    //target.maxMoney = Units.money(ns.getServerMaxMoney(target.name));
    target.availMoney = Units.money(ns.getServerMoneyAvailable(target.name));

    target.hackChances = ns.hackAnalyzeChance(target.name);
    target.hackMoney = ns.hackAnalyze(target.name); // part of amount hacked by one thread

    target.weakThreads = Math.ceil((target.currentSecurity - target.minSecurity) / target.weakSecurityRate);
    target.weakMaxThreads = Math.ceil((100 - target.minSecurity) / target.weakSecurityRate);

    target.hackMaxThreads = Math.floor(1 / target.hackMoney); //max threads to hack maxMoney
    target.maxHackSecurityThreads = (100 - target.minSecurity)/target.hackSecurity
    target.maxGrowSecutiryThreads = (100 - target.minSecurity)/target.growSecurity

    target.growTime = Units.time(ns.getGrowTime(target.name)/1000);
    target.hackTime = Units.time(ns.getHackTime(target.name)/1000);
    target.weakTime = Units.time(ns.getWeakenTime(target.name)/1000);

    target.gapSecurity = 100 - target.currentSecurity;
    target.growSecurityThreads = Math.floor(target.gapSecurity/target.growSecurity); // how many threads affected by grow to up to high value
    target.hackSecurityThreads = Math.floor(target.gapSecurity/target.hackSecurity); // how many threads affected by hack to up to high value

    target.moneyRatio =
        target.availMoney.value > 0
            ? target.availMoney.value == target.maxMoney.value
                ? 1
                : target.maxMoney.value / target.availMoney.value
            : 0;

    let growThreads;
    switch (target.moneyRatio) {
        case 0:
            growThreads = target.growSecurityThreads; // unknown ratio, unkwnown number of threads allowed to up
            break;
        case 1:
            growThreads = 0;
            break;
        default:
            growThreads = Math.floor(ns.growthAnalyze(target.name, target.moneyRatio));
    }

    target.growMaxThreads = growThreads; // max threads to grow money to maxMoney

    target.hackThreads = Math.min(target.hackSecurityThreads, target.hackMaxThreads);
    target.growThreads = Math.min(target.growSecurityThreads, target.growMaxThreads);

    target.hackAmount = Units.money(target.hackThreads * (target.availMoney.value * target.hackMoney));
    target.growAmount = Units.money(target.moneyRatio > 1 && target.growMaxThreads > 0
        ? (target.growThreads / target.growMaxThreads) * (target.maxMoney.value - target.availMoney.value)
        : 0
    );
    target.weakAmount = target.weakThreads * target.weakSecurityRate;

    // calculate sycle
    // target.serverMaxGrowthThreads
    // how mach money could be stolen to grow once to max
    const ha =  target.maxMoney.value * (1-1/target.serverGrowth);
    const ht =  target.hackMoney >0 ? ha/(target.maxMoney.value * target.hackMoney) : 0;

    //optimal hack threads
    target.optmalMaxHackMoney = Units.money(ha);
    target.optimalMaxHackTreads = ht;
    target.optimalHackThreads = Math.min(ht, target.maxHackSecurityThreads);

    //optimal grow threads
    target.optimalGrowThreads = Math.min(target.serverMaxGrowthThreads, target.maxGrowSecutiryThreads);

    target.optimalMaxThreads = Math.max(target.serverMaxGrowthThreads, target.optimalHackThreads);

    target.cycles = (100 - target.minSecurity) / (target.growSecurity * target.serverMaxGrowthThreads + target.hackSecurity * ht);
    target.cycleTime = target.cycles * (target.hackTime.value + target.growTime.value) + target.weakTime.value;
    target.cycleRate = ha * target.cycles;
    target.cycleThreads = target.cycles * (target.serverMaxGrowthThreads + target.hackMaxThreads) + target.weakMaxThreads;
    target.hackRate = target.cycleRate / target.cycleTime;
    target.threadRate = target.cycleRate/target.cycleThreads;
}

// recalculate growth for max threads t
export function calcGrowth(l, server, ga, gr, gt, t) {
    const ns = l.ns;
    l.d(1, "ga %f, gr %f, gt %d t %d", ga, gr, gt, t);
    if (gt <= t) {
        // nothing to recalc
        return [gr, gt];
    }
    const gpt = Math.min(gt,t);
    const m = server.maxMoney.value;

    let gpa = m - (m-ga)/(gt/gpt);
    let gpr = m/gpa;

    let gnt = Math.ceil(ns.growthAnalyze(server.name, gpr));
    let gpr_ = 1 + (gr - 1) /(gnt/gt);
    l.d(1, "gt %d, t %d, ga %f gpa %f gpr %f -> %f, gpt %d gnt %d ", gt, t, ga, gpa, gpr, gpr_, gpt, gnt);
    let i = 0;
    while (Math.abs(gnt - gpt) > 0) { //
        if (i++ > 100) {break};
        const diff = Math.abs(gpr_ - gpr);
        gpr_ = gpr;
        gpr += gnt < gpt ? diff/2 : -diff/2;
        gnt =  Math.ceil(ns.growthAnalyze(server.name, gpr));
    }
    //gpa = ga * gpr;
    l.d(1, "gnt %d, t %d, gpr %f, i %d", gnt, t, gpr, i);
    return [gpr, gnt];
}

// recalculate hack for max threads t
export function calcHack(l, server, hm, ht, t) {
    const ns = l.ns;
    if (ht >= t) {
        // nothing to recalc
        return [hm, t];
    }
    const a = server.availMoney.value;
    const hpt = Math.min(t, ht);
    const hpm_c = hpt * (a * server.hackMoney);  // check math
    let hpm = hm/(hpt/ht);
    let hnt = Math.floor(ns.hackAnalyzeThreads(server.name, hpm));
    let hpm_ = (hm - hpm)/2;
    // ? так, а это точно рассчитывается, поэтому не нужно считать интервалами
    l.d(1, "hm %f ht %d hpt %d hnt %d", hm, ht, hpt, hnt);
    l.d(1, "hm %.2f, hpm_c %.2f hpm %.2f, diff %f", hm, hpm_c, hpm, hpm_);
    let i = 0;
    while (Math.abs(hnt - hpt) > 1) { //
        if (i++ > 1000) {break};
        const diff = Math.abs(hpm_ - hpm);
        hpm_ = hpm;
        hpm += hnt < hpt ? diff/2 : -diff/2;
        hnt = Math.floor(ns.hackAnalyzeThreads(server.name, hpm));
    }
    return [hpm, hnt];
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
    ns.tprintf("this module is a library, import {updateInfo, caclGrowth, calcHack} from '%s'", Module);
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
