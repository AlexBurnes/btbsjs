const Module  = '/h3ml/lib/server-info-min.js';
const Version = '0.3.5.8'; // update this every time when edit the code!!!

import {Constants}    from "/h3ml/lib/constants.js";
import {Units}        from "/h3ml/lib/units.js";
import {serversData}  from "/h3ml/etc/servers.js";
import {securityData} from "/h3ml/etc/security.js";


/** @param {NS} ns
 *  @param {Target||Server} target
**/
export function updateInfo(ns, target) {

    //FIXME use h3ml/ect/servers instead
    // find another way to prepare this information
    // like server.json
    const server = serversData[target.name];

    target.serverGrowth = server.serverGrowth > 1 ? server.serverGrowth : 2;

    //FIXME this information need gather before, for different, but if this information is player depended?
    const security = securityData[0];
    target.weakSecurityRate = security.weakSecutiryRate;
    target.hackSecurity     = security.hackSecutiryRate;  // security grow on hack by one thread
    target.growSecurity     = security.growSecutiryRate;  // security groe on hack by one thread

    target.serverMaxGrowthThreads = Math.ceil(ns.growthAnalyze(target.name, target.serverGrowth));

    target.availMoney = Units.money(ns.getServerMoneyAvailable(target.name));

    target.hackChances = ns.hackAnalyzeChance(target.name);
    target.hackMoney = ns.hackAnalyze(target.name); // part of amount hacked by one thread

    target.weakThreads = Math.ceil((target.currentSecurity - target.minSecurity) / target.weakSecurityRate);
    target.weakMaxThreads = Math.ceil((100 - target.minSecurity) / target.weakSecurityRate);

    // money to stole, to grow current value at once!
    target.hackMaxThreads = target.hackMoney ? ns.hackAnalyzeThreads(target.name, target.availMoney.value * (1-1/target.serverGrowth)) : 0;
    // max threads to hack maxMoney
    target.maxHackSecurityThreads = (100 - target.minSecurity)/target.hackSecurity
    target.maxGrowSecutiryThreads = (100 - target.minSecurity)/target.growSecurity


    target.moneyRatio =
        target.availMoney.value > 0
            ? target.availMoney.value == target.maxMoney.value
                ? 1
                : target.maxMoney.value / target.availMoney.value
            : 0;

    let growThreads;
    switch (target.moneyRatio) {
        case 0:
            growThreads = target.serverMaxGrowthThreads; // unknown ratio, unkwnown number of threads allowed to up
            break;
        case 1:
            growThreads = 0;
            break;
        default:
            growThreads = Math.floor(ns.growthAnalyze(target.name, Math.min(target.moneyRatio, target.serverGrowth)));
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

    // calculate optmial hack
    // target.serverMaxGrowthThreads
    // how mach money could be stolen to grow once to max
    const ha = target.maxMoney.value * (1-1/target.serverGrowth);
    //const ht = target.hackMoney >0 ? ha/(target.maxMoney.value * target.hackMoney) : 0;
    const ht = ns.hackAnalyzeThreads(target.name, ha);

    //optimal hack threads
    target.optimalHackMoney   = Units.money(ha);
    target.optimalHackThreads = target.hackMaxThreads;

    //optimal grow threads
    target.optimalGrowThreads = target.serverMaxGrowthThreads || 0;
    target.optimalThreads     = Math.max(target.optimalGrowThreads, target.optimalHackThreads);

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
