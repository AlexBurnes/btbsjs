const Module  = '/h3ml/lib/server-info-min.js';
const Version = '0.3.5.11'; // update this every time when edit the code!!!

import {Units}        from "/h3ml/lib/units.js";
import {securityData} from "/h3ml/etc/security.js";

/** @param {NS} ns
 *  @param {Target||Server} target
**/
export function updateInfo(ns, target) {

    //FIXME use h3ml/ect/servers instead
    // find another way to prepare this information
    // like server.json

    //FIXME this information need gather before, for different, but if this information is player depended?
    target.weakSecurityRate = securityData["weakRate"][0];
    target.hackSecurity     = securityData["hackRate"];  // security grow on hack by one thread
    target.growSecurity     = securityData["growRate"];  // security grow on hack by one thread

    const serverGrowth = target.serverGrowth > 1  ? target.serverGrowth : 2;

    //ns.tprint(`${target.name}, ${target.serverGrowth}`);
    target.serverMaxGrowthThreads = Math.ceil(ns.growthAnalyze(target.name, serverGrowth));

    target.availMoney = Units.money(ns.getServerMoneyAvailable(target.name));
    target.maxMoney = Units.money(ns.getServerMaxMoney(target.name));

    target.minSecurity = ns.getServerMinSecurityLevel(target.name);

    target.weakThreads = Math.ceil((target.currentSecurity - target.minSecurity) / target.weakSecurityRate);

    target.weakMaxThreads = Math.ceil((100 - target.minSecurity) / target.weakSecurityRate);

    // money to stole, to grow current value at once! :)
    target.minMoney = target.maxMoney.value / serverGrowth;

    target.hackMaxThreads =
        Math.floor(target.availMoney.value) > target.minMoney && target.currentSecurity < 100
        ? ns.hackAnalyzeThreads(target.name, Math.floor(target.availMoney.value * (1-1/serverGrowth)))
        : 0;

    if (isNaN(target.hackMaxThreads)) target.hackMaxThreads = 0;

    // max threads to hack maxMoney
    target.hackSecurityThreads = (100 - target.minSecurity)/target.hackSecurity;
    target.growSecurityThreads = (100 - target.minSecurity)/target.growSecurity;

    target.growTime = Units.time(ns.getGrowTime(target.name)/1000);
    target.hackTime = Units.time(ns.getHackTime(target.name)/1000);
    target.weakTime = Units.time(ns.getWeakenTime(target.name)/1000);

    target.moneyRatio =
        target.availMoney.value > 0
            ? target.availMoney.value == target.maxMoney.value
                ? 1
                : target.maxMoney.value / target.availMoney.value
            : 0;
    if (target.moneyRatio < 1) target.moneyRatio = 0;

    let growThreads;
    switch (target.moneyRatio) {
        case 0:
            growThreads = target.serverMaxGrowthThreads; // unknown ratio, unkwnown number of threads allowed to up
            break;
        case 1:
            growThreads = 0;
            break;
        default:
            //ns.tprint(`${target.name}, ${target.moneyRatio}, ${target.serverGrowth}`);
            growThreads = Math.floor(ns.growthAnalyze(target.name, Math.min(target.moneyRatio, serverGrowth)));
    }
    target.growMaxThreads = growThreads; // max threads to grow money to maxMoney

    target.hackThreads = target.hackMaxThreads;
    target.growThreads = target.growMaxThreads;

    // how mach money could be stolen to grow once to max
    target.hackAmount = target.maxMoney.value * (1-1/serverGrowth);

    //optimal hack threads, this is wrong when vailMone < maxMoney, you could't not calculate so need calc it by other way
    target.optimalHackMoney   = Units.money(target.hackAmount);
    target.optimalHackThreads = target.currentSecurity < 100 ? Math.max(ns.hackAnalyzeThreads(target.name, target.hackAmount), target.hackThreads) : 0;

    //optimal grow threads
    target.optimalGrowThreads = target.serverMaxGrowthThreads || 0;
    target.optimalThreads     = Math.max(target.optimalGrowThreads, target.optimalHackThreads);

    //ns.tprint(`${target.name} ${target.optimalGrowThreads}  ${target.growSecurity}\
    //${target.optimalGrowThreads} ${target.weakSecurityRate}  ${target.optimalHackThreads}  ${target.hackSecurity}\
    //${target.optimalHackThreads} ${target.weakSecurityRate}`);
    target.cycleThreads       = target.optimalGrowThreads + Math.ceil(target.growSecurity * target.optimalGrowThreads/target.weakSecurityRate)
                              + target.optimalHackThreads + Math.ceil(target.hackSecurity * target.optimalHackThreads/target.weakSecurityRate);
    target.cycleTime          = Units.time(Math.max(target.growTime.value, target.hackTime.value, target.weakTime.value) + 4 * 500/1000);
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
    if (Math.floor(hm) == 0) {
        return [0, 0];
    }
    const a = server.availMoney.value;
    const hpt = Math.min(t, ht);
    const hpm_c = hpt * (a * server.hackMoney);  // check math
    let hpm = hm/(hpt/ht);
    let hnt = Math.floor(ns.hackAnalyzeThreads(server.name, hpm));
    let hpm_ = (hm - hpm)/2;
    l.d(1, "hm %f ht %d hpt %d hnt %d", hm, ht, hpt, hnt);
    l.d(1, "hm %.2f, hpm %.2f, diff %f", hm, hpm, hpm_);
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
    ns.tprintf("module %s version %s", Module, Version);
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
