/** @param {NS} ns 
 *  @param {string} name
**/
import {costFormat, timeFormat} from "lib-units.js"

// version 0.1.0

/** @param {NS} ns 
 *  @param {Target||Server} target
**/
export function updateInfo(ns, target) {
    if (!ns.serverExists(target.name)) return;
    const server = ns.getServer(target.name); // 2G usage, must expensive function here
    target.backdoor = server.backdoorInstalled;
    target.serverGrowth = server.serverGrowth;
    target.serverMaxGrowthThreads = server.serverGrowth > 1 ? Math.ceil(ns.growthAnalyze(target.name, server.serverGrowth)) : 0;
    target.hackingLevel = ns.getServerRequiredHackingLevel(target.name);
    target.numPorts = ns.getServerNumPortsRequired(target.name);
    target.analyzeChance = ns.hackAnalyzeChance(target.name);
    target.rootAccess = ns.hasRootAccess(target.name);
    target.usedRam = ns.getServerUsedRam(target.name);
    target.maxRam  = ns.getServerMaxRam(target.name);
    target.availRam = target.maxRam - target.usedRam;
    target.minSecurity = ns.getServerMinSecurityLevel(target.name);
    target.currentSecurity = ns.getServerSecurityLevel(target.name);
    target.weakSecurity = 0.05;
    
    target.weakThreads = Math.ceil((target.currentSecurity - target.minSecurity) / target.weakSecurity);
    target.weakMaxThreads = Math.ceil((100 - target.minSecurity) / target.weakSecurity);
    
    target.maxMoney = costFormat(ns.getServerMaxMoney(target.name));
    target.availMoney = costFormat(ns.getServerMoneyAvailable(target.name));
    target.hackChances = ns.hackAnalyzeChance(target.name);
    target.hackMoney = ns.hackAnalyze(target.name); // part of amount hacked by one thread
    target.hackSecurity = ns.hackAnalyzeSecurity(1);	// security grow on hack by one thread
    target.growSecurity = ns.growthAnalyzeSecurity(1);  // security groe on hack by one thread

    //optimal hack threads  
    target.optimalHackThreads = Math.floor((1 - 1/target.serverGrowth) / target.hackMoney);
    target.optimalMaxThreads = Math.max(target.serverMaxGrowthThreads, target.optimalHackThreads);
    
    target.growTime = timeFormat(ns.getGrowTime(target.name)/1000);
    target.hackTime = timeFormat(ns.getHackTime(target.name)/1000);
    target.weakTime = timeFormat(ns.getWeakenTime(target.name)/1000);

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


    target.hackMaxThreads  = Math.floor(1 / target.hackMoney); //max threads to hack maxMoney

    target.hackThreads = Math.min(target.hackSecurityThreads, target.hackMaxThreads);
    target.growThreads = Math.min(target.growSecurityThreads, target.growMaxThreads);

    target.hackAmount = costFormat(target.hackThreads * (target.availMoney.value * target.hackMoney));
    target.growAmount = costFormat(target.moneyRatio > 1 && target.growMaxThreads > 0 
	? (target.growThreads / target.growMaxThreads) * (target.maxMoney.value - target.availMoney.value) 
	: 0
    );
    target.weakAmount = target.weakThreads * target.weakSecurity;

}
