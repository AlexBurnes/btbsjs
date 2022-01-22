// server-stat.js
// version 0.1.0
/*
    analyze server statistics and print hack strategy - old version, next version server-analyze.js
*/

import {round} from "lib-utils.js"
import {costFormat} from "lib-units.js"
import {Logger} from "log.js"
import {Target} from "target.js"
import {updateInfo} from "lib-server-info-full.js"

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

    ns.tprintf("'%s' info:", server);

    const lg = new Logger(ns);
    const target = new Target(lg, server, host);
    updateInfo(ns, target);
    ns.tprint(target);

    const usedRam = ns.getServerUsedRam(server);
    const maxRam = ns.getServerMaxRam(server);
    ns.tprintf("\tmemory: %.2fGb / %.2fGb ", usedRam, maxRam);

    const availRam = maxRam - usedRam;
    const threadCost = ns.getScriptRam("worker.js");
    const maxThreads = availRam > 0 ? Math.floor(availRam / threadCost) : 0;
    ns.tprintf("\t'%s' max threads: %d", server, maxThreads);

    const hostAvailRam = ns.getServerMaxRam(host); // - ns.getServerUsedRam(host);
    const hostMaxThreads = hostAvailRam > 0 ? Math.floor(hostAvailRam / threadCost) : 0;
    ns.tprintf("\t'%s' max threads: %d", host, hostMaxThreads);

    const minSecurity = ns.getServerMinSecurityLevel(server);
    const currentSecurity = ns.getServerSecurityLevel(server);
    const baseSecurity = ns.getServerBaseSecurityLevel(server);
    const weakThreads = Math.ceil((currentSecurity - minSecurity) / 0.05);
    const weakSecurity = weakThreads * 0.05;
    ns.tprintf("\tsecurity: %.2f / %.2f threads required %d", minSecurity, currentSecurity, weakThreads);

    const maxMoney = ns.getServerMaxMoney(server);
    const availMoney = ns.getServerMoneyAvailable(server);
    const maxMoneyFmt = costFormat(maxMoney);
    const availMoneyFmt = costFormat(availMoney);
    ns.tprintf("\tmoney: %.2f%s / %.2f%s ", availMoneyFmt.cost, availMoneyFmt.unit, maxMoneyFmt.cost, maxMoneyFmt.unit);

    const hackChances = 100 * ns.hackAnalyzeChance(server);
    const hackMoney = availMoney * ns.hackAnalyze(server);
    const hackSecurity = ns.hackAnalyzeSecurity(1);
    ns.tprintf("\thack: chance %.2f%%, money %f, security %f", hackChances, hackMoney, hackSecurity);

    const growTime = ns.getGrowTime(server);
    const hackTime = ns.getHackTime(server);
    const weakTime = ns.getWeakenTime(server);
    ns.tprintf("\ttimes: grow %.2fs, hack %.2fs, weak %.2fs",
    round(growTime / 1000, 2), round(hackTime / 1000, 2), round(weakTime / 1000, 2)
    );

    // нужно несколько другой алгоритм для хаккинга продумать
    // нужно брать столько что бы сервер успевал восполнять и при этом рос
    // avail - avail * C = avail * R
    // C = 0.95, R = 1.1
    // ratio = (avail * R) / (avail - avail * C) => avail * R / avail (1 - C) => R/(1-C) 1.1/1-0.95 =>

    // сколько нужно ниток что бы восполнить украденные деньги?
    let growHackCoeff = 1;
    while (true) {
    const growRatio = ns.growthAnalyze(server, 1 + growHackCoeff++ * ns.hackAnalyze(server));
    if (growRatio >= 1 || growRatio == 0 || growHackCoeff > 1000) break;
    }
    const growHackThreads = ns.growthAnalyze(server, 1 + growHackCoeff * ns.hackAnalyze(server));
    const growHackRatio = 1 + growHackCoeff * ns.hackAnalyze(server);
    ns.tprintf("\tneed grow threads %d to compensate stollen money by one thread, ratio %f", growHackThreads, growHackRatio);

    const growCoeff = 1.5;
    const hackCoeff = 0.5

    const moneyRatio =
    availMoney > 0
        ? availMoney == maxMoney
        ? 1
        : (availMoney * growCoeff > maxMoney) ? maxMoney / availMoney : growCoeff / (1 - hackCoeff)
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

    ns.tprintf("\tgrow: ratio %f threads required %d", moneyRatio, growThreads);

    /*
    сколько денег можно взять зараниее
    нужно взять столько что бы за один вызов восстановить их
    и что бы за один вызов можно было восстановить уровень безопасности

    вот и стратегия

    если уровень security слишком большой то его нужно опустить
    если количество денег небольшое то их нужно поднять, вопрос только на сколько?

    */

    //FIXME predict money after grow
    // predict hack threads for maxMoney
    let maxHackThreads = Math.floor((hackCoeff * maxMoney) / hackMoney);
    if (parseFloat(maxHackThreads) == "Infinity") {
        maxHackThreads = 0;
    }
    const maxHackSecurity = maxHackThreads ? ns.hackAnalyzeSecurity(maxHackThreads) : 0;

    if (maxHackThreads > 0) {
    ns.tprintf("\thack max money required %d threads, security up %.2f", maxHackThreads,  maxHackSecurity);
    }
    if (weakThreads > 0) {
    ns.tprintf("\tweak required %d threads, security down %.2f", weakThreads, weakSecurity);
    }

    ns.tprintf("strategy:");
    if (availMoney > 0.5 * maxMoney) {
    // steal all
    let hackThreads = Math.floor((hackCoeff * availMoney) / hackMoney);
    //FIXME ns.hackAnalyzeThreads is buggy, return number of threads to hack max server money
    //availMoney has no effect!!!!
    //let hackThreads = ns.hackAnalyzeThreads(server, availMoney);
    if (parseFloat(hackThreads) == "Infinity") {
        hackThreads = 0;
    }
    const hackSecurity = hackThreads ? ns.hackAnalyzeSecurity(Math.min(hackThreads, hostMaxThreads)) : 0;
    const growSecurity = growThreads ? ns.growthAnalyzeSecurity(Math.min(growThreads, hostMaxThreads)) : 0;

    // стоимосто нужно считать по количеству доступных ниток
    const growCost = growThreads ? (maxMoney - availMoney)/Math.min(growThreads, hostMaxThreads)/(growTime/1000) : 0;
    const hackCost = hackThreads ? availMoney/Math.min(hackThreads, hostMaxThreads)/(hackTime/1000) : 0;
    ns.tprintf("\thack cost %.2f threads %d security %.2f, grow cost %.2f threads %d security %.2f",
        hackCost, hackThreads, hackSecurity, growCost, growThreads, growSecurity
    );

    if (hackThreads > 0 && growThreads > 0) {
        if (growCost > hackCost) {
        hackThreads = 0;
        }
    }

    // если уровень сервера зашкаливает и если количество ниток для снижения уровня сервера
    // стало больше чем ниток для взлома, то понижаем уровень security
    if (
        currentSecurity > baseSecurity ||
        (
            (currentSecurity + (hackThreads ? hackSecurity : growSecurity)) >= 100 &&
            weakThreads > 0 && weakThreads > (hackThreads ? hackThreads : growThreads)
        )
    ){
        ns.tprintf("\tweak required %d threads, security down %.2f", weakThreads, weakSecurity);
    }
    else if (hackThreads > 0) {
        ns.tprintf("\thack required %d threads, security up %.2f", hackThreads,  hackSecurity);
    }
    else if (growThreads > 0) {
        ns.tprintf("\tgrow required %d threads, securty up %.2f", growThreads, growSecurity);
    }

    }
    else {
        if (maxMoney) {
            ns.tprintf("\tserver dont have enough money or unable to hack, try to grow or week");
            const growSecurity = ns.growthAnalyzeSecurity(growThreads);
            if (
                currentSecurity > baseSecurity ||
                (
                    currentSecurity + growSecurity >= 100 &&
                    weakThreads > 0 && weakThread > growThreads
                )
            ){
                ns.tprintf("\tweak required %d threads, security down %.2f", weakThreads, weakSecurity);
            }
            else {
                ns.tprintf("\tgrow required %d threads, securty up %.2f", growThreads, growSecurity);
            }
        }
        else {
            ns.tprintf("\tserver could't have money");
        }
    }

}

/**
 * @param {{servers: any[]}} data
 * @param {any[]} args
 * @returns {*[]}
 */
export function autocomplete(data, args) {
    return [...data.servers];
}
