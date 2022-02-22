const Module  = '/h3ml/bin/hack-hash.js';
const Version = '0.3.6.34'; // update this every time when edit the code!!!

/*
    Grow hacknet servers to max nodes and spend hashes for money or other goals

    to work need source file getOwnedSourceFiles() 9.1

*/

import {Constants}  from "/h3ml/lib/constants.js";
import {Logger}     from "/h3ml/lib/log.js"
import {Units}      from "/h3ml/lib/units.js"
import {settings}   from "h3ml-settings.js";

const ms = Constants.ms;

const upgradeLevel = 0;
const upgradeRam   = 1;
const upgradeCpu   = 2;
const upgradeCache = 3;

/*
[
    "Sell for Money",
    "Sell for Corporation Funds",
    "Reduce Minimum Security",
    "Increase Maximum Money",
    "Improve Studying",
    "Improve Gym Training",
    "Exchange for Corporation Research",
    "Exchange for Bladeburner Rank",
    "Exchange for Bladeburner SP",
    "Generate Coding Contract"
]
*/

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
    ns.tprintf("usage: %s --version [--update-port] | --help", Module);
    ns.tprintf("this module is a library, import {some} from '%s'", Module); // in case of a library
    ns.tprintf("module description"); // in case of a module
    return;
}

/** @param {NS} ns **/
export async function main(ns) {
    const args = ns.flags([
        [ 'version'     , false ],
        [ 'update-port' , 0     ],
        [ 'help'        , false ],
        [ 'log'         , 1     ], // log level - 0 quiet, 1 and more verbose
        [ 'debug'       , 0     ], // debug level
        [ 'verbose'     , true  ], // verbose mode, short analog of --log-level 1
        [ 'quiet'       , false ]  // quiet mode, short analog of --log-level 0

    ]);

    if (args['version']) {
        return version(ns, args['update-port']);
    }
    if (args['help']) {
        return help(ns);
    }

    const [nodes] = args["_"];
    const l = new Logger(ns, {args: args});

    let numNodes = ns.hacknet.numNodes();
    let maxNumNodes =  nodes || 24;

    if (maxNumNodes == numNodes) {
        l.g(1, "maximum hacknet nodes %d/%d", numNodes, maxNumNodes);
        return;
    }

    l.g(1, "hacknet nodes %d/%d", numNodes, maxNumNodes);

    // unknown -1
    const maxLevel = -1;
    const maxRam   = -1;
    const maxCore  = -1;
    const maxHash  = -1;

    let minUpgradeNode = -1;
    let minUpgradeCost = -1;
    let minUpgradeWhat = -1;
    let productionRate = 0;

    let nodeCost = numNodes < maxNumNodes ? ns.hacknet.getPurchaseNodeCost() : -1;

    let needUpgrade = false;

    let hashCapacity = 0.5; // over 50 sell

    const upgrade_fn = function (what, cost) {
        if (cost.isFinite()) {
            needUpgrade = true;
            if (minUpgradeCost == -1 || minUpgradeCost > cost) {
                minUpgradeCost = cost;
                minUpgradeNode = node.index;
                minUpgradeWhat = what;
            }
        }
    }

    const upgrade_reset = function() {
        minUpgradeNode = -1;
        minUpgradeCost = -1;
        minUpgradeWhat = -1;
        productionRate = 0;
    }

    while (true) {

        const availMoney = ns.getServerMoneyAvailable("home");

        let nodes = [];
        productionRate = 0;
        for(let i = 0; i < numNodes; i++) {
            const node = ns.hacknet.getNodeStats(i);
            node.index = i;
            nodes[i] = node;
            productionRate += node.production;
        }
        l.d(1, "total nodes %d production rate %d", nodes.length, productionRate);

        needUpgrade = false;

        nodes
            .forEach( node => {
                l.d(1, "node[%d] level %d ram %d cpu %d", node.index, node.level, node.ram, node.cores);
                if (node.level < maxLevel || maxLevel ==1)   upgrade_fn(upgradeLevel, ns.hacknet.getLevelUpgradeCost(node.index, 1));
                if (node.ram < maxRam     || maxRam == -1)   upgrade_fn(upgradeRam,   ns.hacknet.getRamUpgradeCost(node.index, 1));
                if (node.cores < maxCore  || maxCore == -1)  upgrade_fn(upgradeCpu,   ns.hacknet.getCoreUpgradeCost(node.index, 1));
                if (node.cache < maxCache || maxCache == -1) upgrade_fn(upgradeCache, ns.hacknet.getCacheUpgradeCost(node.index, 1));
            });

        l.d(1, "node cost %d, upgrade cost %d, upgrade node %d, upgrade what %d",
            nodeCost, minUpgradeCost, minUpgradeNode, minUpgradeWhat
        );

        if (nodeCost > 0 && (nodeCost < minUpgradeCost || minUpgradeCost == -1)) {
            if (nodeCost < availMoney) {
                const price = Units.money(nodeCost);
                l.d(1, "purchase node for %.2f%s$", price.amount, price.unit);
                ns.hacknet.purchaseNode();
                numNodes = ns.hacknet.numNodes();
                upgrade_reset();
                nodeCost = numNodes < maxNumNodes ? ns.hacknet.getPurchaseNodeCost() : -1;
            }
        }
        else {
            if (minUpgradeCost < availMoney) {
                const price = Units.money(minUpgradeCost);
                switch(minUpgradeWhat) {
                    case upgradeLevel:
                        l.d(1, "upgrade node %d level for %.2f%s$", minUpgradeNode, price.amount, price.unit);
                        ns.hacknet.upgradeLevel(minUpgradeNode, 1);
                        break;
                    case upgradeRam:
                        l.d(1, "upgrade node %d ram for %.2f%s$", minUpgradeNode, price.amount, price.unit);
                        ns.hacknet.upgradeRam(minUpgradeNode, 1);
                        break;
                    case upgradeCpu:
                        l.d(1, "upgrade node %d cpu for %.2f%s$", minUpgradeNode, price.amount, price.unit);
                        ns.hacknet.upgradeCore(minUpgradeNode, 1);
                        break;
                    case upgradeCache:
                        l.d(1, "upgrade node %d cache for %.2f%s$", minUpgradeNode, price.amount, price.unit);
                        ns.hacknet.upgradeCache(minUpgradeNode, 1);
                        break;
                }
                upgrade_reset();
            }
        }

        numNodes = ns.hacknet.numNodes();

        //spend hashes
        if (ns.hashCapacity()/numHashes() > hashCapacity) {
            if (numHashes() - (ns.hashCapacity() * hashCapacity) > ns.hashCost("Sell for Money")) {
                hacknet.spendHashes("Sell for Money");
            }
        }

        // spend hashes if still upgrading
        if (needUpgrade || nodeCost > 0) {
            if (numHashes() > ns.hashCost("Sell for Money")) {
                hacknet.spendHashes("Sell for Money");
            }
        }

        // if nothing to do
        if (needUpgrade == false || nodeCost < 0 || ns.hashCapacity()/numHashes() < hashCapacity) {
            await ns.sleep(1 * ms);
        }

    }

}
