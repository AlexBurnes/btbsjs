// server-hack.js
// version 0.1.0

import {round } from "lib-utils.js"
import {costFormat} from "lib-units.js"
import {Target} from "target.js"
import {Logger} from "log.js"

async function hackServer(target, once = false) {

    const server = target.name;
    const host = target.host;
    const ns = target.ns;
    const lg = target.lg;

    while (true) {
    lg.log(1, "'%s' info:", server);

    const usedRam = ns.getServerUsedRam(server);
    const maxRam = ns.getServerMaxRam(server);
    lg.log(1, "\tmemory: %.2fGb / %.2fGb ", usedRam, maxRam);

    const availRam = maxRam - usedRam;

    if (!ns.fileExists('worker.js', host)) {
        ns.tprintf("there is no worker script at host '%s'", host);
        return;
    }
    const threadCost = ns.getScriptRam('worker.js');
    const maxThreads = availRam > 0 ? Math.floor(availRam / threadCost) : 0;

    lg.log(1, "\t'%s' max threads: %d", server, maxThreads);

    const hostAvailRam = ns.getServerMaxRam(host) - ns.getServerUsedRam(host);
    const hostMaxThreads = hostAvailRam > 0 ? Math.floor(hostAvailRam / threadCost) : 0;
    lg.log(1, "\t'%s' max threads: %d", host, hostMaxThreads);
    if (hostMaxThreads == 0) {
        ns.tprintf("there is no free threads on server '%s'", host);
        return;
    }

    const minSecurity = ns.getServerMinSecurityLevel(server);
    const currentSecurity = ns.getServerSecurityLevel(server);
    const baseSecurity = ns.getServerBaseSecurityLevel(server);
    const weakThreads = Math.ceil((currentSecurity - minSecurity) / 0.05);
    const weakSecurity = weakThreads * 0.05;
    lg.log(1, "\tsecurity: %.2f / %.2f threads required %d", minSecurity, currentSecurity, weakThreads);

    const maxMoney = ns.getServerMaxMoney(server);
    const availMoney = ns.getServerMoneyAvailable(server);
    const maxMoneyFmt = costFormat(maxMoney);
    const availMoneyFmt = costFormat(availMoney);
    lg.log(1, "\tmoney: %.2f%s / %.2f%s ", availMoneyFmt.cost, availMoneyFmt.unit, maxMoneyFmt.cost, maxMoneyFmt.unit);

    const hackChances = 100 * ns.hackAnalyzeChance(server);
    const hackMoney = availMoney * ns.hackAnalyze(server);
    const hackSecurity = ns.hackAnalyzeSecurity(1);
    lg.log(1, "\thack: chance  %.2f%%, money %f, security %f", hackChances, hackMoney, hackSecurity);

    const growTime = ns.getGrowTime(server);
    const hackTime = ns.getHackTime(server);
    const weakTime = ns.getWeakenTime(server);
    lg.log(1, "\ttimes: grow %.2fs, hack %.2fs, weak %.2fs",
        round(growTime / 1000, 2), round(hackTime / 1000, 2), round(weakTime / 1000, 2)
    );

    const moneyRatio =
        availMoney
        ? availMoney == maxMoney
            ? 1
            : maxMoney / availMoney
        : 0;
    let growThreads;
    switch (moneyRatio) {
        case 0:
        growThreads = hostMaxThreads;
        break;
        case 1:
        growThreads = 0;
        break;
        default:
        growThreads = Math.floor(ns.growthAnalyze(server, moneyRatio));
    }
    lg.log(1, "\tgrow: ratio %.2f threads required %d", moneyRatio, growThreads);

    let maxHackThreads = Math.floor((0.95 * maxMoney) / hackMoney);
    if (parseFloat(maxHackThreads) == "Infinity") {
        maxHackThreads = 0;
    }
    const maxHackSecurity = maxHackThreads ? ns.hackAnalyzeSecurity(maxHackThreads) : 0;

    if (maxHackThreads > 0)  {
        lg.log(1, "\thack max money required %d threads, security up %.2f", maxHackThreads, maxHackSecurity);
    }
    if (weakThreads > 0) {
        lg.log(1, "\tweak required %d threads, security down %.2f", weakThreads, weakSecurity);
    }

    lg.log(1, "strategy:");
    if (availMoney) {
        let hackThreads = Math.floor((0.95 * availMoney) / hackMoney);
        if (parseFloat(hackThreads) == "Infinity") {
        hackThreads = 0;
        }
        const hackSecurity = hackThreads ? ns.hackAnalyzeSecurity(Math.min(hackThreads, hostMaxThreads)) : 0;
        const growSecurity = growThreads ? ns.growthAnalyzeSecurity(Math.min(growThreads, hostMaxThreads)) : 0;

        const growCost = growThreads ? (maxMoney - availMoney)/Math.min(growThreads, hostMaxThreads)/(growTime/1000) : 0;
        const hackCost = hackThreads ? availMoney/Math.min(hackThreads, hostMaxThreads)/(hackTime/1000) : 0;
        lg.log(1, "\thack cost %.2f, grow cost %.2f", hackCost, growCost);

        if (hackThreads > 0 && growThreads > 0) {
        if (growCost > hackCost) {
            hackThreads = 0;
        }
        }

        if (
        currentSecurity > baseSecurity ||
        (
            (currentSecurity + (hackThreads ? hackSecurity : growSecurity)) >= 100 &&
            weakThreads > 0 && weakThreads > (hackThreads ? hackThreads : growThreads)
        )
        ) {
        lg.log(1, "\tweak required %d threads, security down %.2f", weakThreads, weakSecurity);
        await target.weaken(Math.min(weakThreads, hostMaxThreads), { await: true });
        }
        else if (hackThreads > 0) {
        lg.log(1, "\thack required %d threads, security up %.2f", hackThreads, hackSecurity);
        await target.hack(Math.min(hackThreads, hostMaxThreads), { await: true });
        }
        else if (growThreads > 0) {
        lg.log(1, "\tgrow required %d threads, securty up %.2f", growThreads, growSecurity);
        await target.grow(Math.min(growThreads, hostMaxThreads), { await: true });
        }

    }
    else {
        if (maxMoney) {
        lg.log(1, "\tserver dont have money or unable to hack, try to max grow");
        const growSecurity = ns.growthAnalyzeSecurity(growThreads);
        if (
            currentSecurity > baseSecurity ||
            (
            currentSecurity + growSecurity >= 100 &&
            weakThreads > 0 && weakThreads > growThreads
            )
        ) {
            lg.log(1, "\tweak required %d threads, security down %.2f", weakThreads, weakSecurity);
            await target.weaken(Math.min(weakThreads, hostMaxThreads), { await: true });
        }
        else {
            lg.log(1, "\tgrow required %d threads, securty up %.2f", growThreads, growSecurity);
            await target.grow(Math.min(growThreads, hostMaxThreads), { await: true });
        }
        }
        else {
        lg.log(1, "\tserver co uld't have money");
        return;
        }
    }

    if (once == true) {
        return;
    }
    await ns.sleep(1000);
    }
}

/** @param {NS} ns **/
export async function main(ns) {
    let [server, host] = ns.args;
    if (!ns.getServerSecurityLevel(server)) {
        ns.tprintf("server %s do not exists", server);
        return;
    }
    if (host == undefined) host = ns.getHostname();
    if (!ns.hasRootAccess(host)) {
        ns.tprintf("'%s' no root access", host);
        return;
    }
    const lg = new Logger(ns, {logLevel: 1, debugLevel: 0});
    const target = new Target(lg, server, host);

    const once = false;
    await hackServer(target, once);

    if (once) ns.tprintf("server-hack done host %s target %s", host, server);

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
