const Module  = '/h3ml/bin/hack-net.js';
const Version = '0.3.5.24'; // update this every time when edit the code!!!

/*
    Grow hacknet to max nodes
*/

import {Constants}  from "/h3ml/lib/constants.js";
import {Logger}     from "/h3ml/lib/log.js"
import {Units}      from "/h3ml/lib/units.js"
import {settings}   from "h3ml-settings.js";


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

    const maxLevel = 200;
    const maxRam   = 64;
    const maxCore  = 16;

    let minUpgradeNode = -1;
    let minUpgradeCost = -1;
    let minUpgradeWhat = -1; // 0 level, 1 ram, 2 cpu
    let productionRate = 0;

    let nodeCost = ns.hacknet.getPurchaseNodeCost();

    let needUpgrade = true;

    while (numNodes <= maxNumNodes || needUpgrade) {

        const availMoney = ns.getServerMoneyAvailable("home");

        if (minUpgradeCost > 0 && Math.min(minUpgradeCost, nodeCost) > availMoney) {
            let timeout = 1000;
            if (productionRate > 0) {
                timeout = ((Math.min(minUpgradeCost, nodeCost) - availMoney)/productionRate)*1000;
            }
            await ns.sleep(timeout);
        }

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
                if (node.level < maxLevel) {
                    needUpgrade = true;
                    const cost = ns.hacknet.getLevelUpgradeCost(node.index, 1);
                    if (minUpgradeCost == -1 || minUpgradeCost > cost) {
                    minUpgradeCost = cost;
                    minUpgradeNode = node.index;
                    minUpgradeWhat = 0;
                    }
                }
                if (node.ram < maxRam) {
                    needUpgrade = true;
                    const cost = ns.hacknet.getRamUpgradeCost(node.index, 1);
                    if (minUpgradeCost == -1 || minUpgradeCost > cost) {
                    minUpgradeCost = cost;
                    minUpgradeNode = node.index;
                    minUpgradeWhat = 1;
                    }
                }
                if (node.cores < maxCore) {
                    needUpgrade = true;
                    const cost = ns.hacknet.getCoreUpgradeCost(node.index, 1);
                    if (minUpgradeCost == -1 || minUpgradeCost > cost) {
                    minUpgradeCost = cost;
                    minUpgradeNode = node.index;
                    minUpgradeWhat = 2;
                    }
                }
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
                minUpgradeNode = -1;
                minUpgradeCost = -1;
                minUpgradeWhat = -1; // 0 level, 1 ram, 2 cpu
                productionRate = 0;
                nodeCost = numNodes < maxNumNodes ? ns.hacknet.getPurchaseNodeCost() : -1;
            }
        }
        else {
            if (minUpgradeCost < availMoney) {
                const price = Units.money(minUpgradeCost);
                switch(minUpgradeWhat) {
                    case 0:
                        l.d(1, "upgrade node %d level for %.2f%s$", minUpgradeNode, price.amount, price.unit);
                        ns.hacknet.upgradeLevel(minUpgradeNode, 1);
                        break;
                    case 1:
                        l.d(1, "upgrade node %d ram for %.2f%s$", minUpgradeNode, price.amount, price.unit);
                        ns.hacknet.upgradeRam(minUpgradeNode, 1);
                        break;
                    case 2:
                        l.d(1, "upgrade node %d cpu for %.2f%s$", minUpgradeNode, price.amount, price.unit);
                        ns.hacknet.upgradeCore(minUpgradeNode, 1);
                        break;
                }
                minUpgradeNode = -1;
                minUpgradeCost = -1;
                minUpgradeWhat = -1; // 0 level, 1 ram, 2 cpu
                productionRate = 0;
            }
        }

        numNodes = ns.hacknet.numNodes();
        if (needUpgrade == false || minUpgradeCost > availMoney) await ns.sleep(1000);
    }
    l.g(1, "hack-net done, maximum nodes");

}
