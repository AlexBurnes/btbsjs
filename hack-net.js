// hack-net.js
// version 0.1.10
/*

    Grow hacknet to max nodes

*/

import {costFormat} from "lib-units.js"
import {Logger} from "log.js";


/** @param {NS} ns **/
export async function main(ns) {
    const [nodes] = ns.args;
    const lg = new Logger(ns);

    let numNodes = ns.hacknet.numNodes();
    let maxNumNodes =  nodes || 24;

    if (maxNumNodes == numNodes) {
        lg.log(1, "maximum hacknet nodes %d/%d", numNodes, maxNumNodes);
        return;
    }

    lg.log(1, "hacknet nodes %d/%d", numNodes, maxNumNodes);

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
        lg.debug(1, "total nodes %d production rate %d", nodes.length, productionRate);

        needUpgrade = false;

        nodes
            .forEach( node => {
                lg.debug(1, "node[%d] level %d ram %d cpu %d", node.index, node.level, node.ram, node.cores);
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

        lg.debug(1, "node cost %d, upgrade cost %d, upgrade node %d, upgrade what %d",
            nodeCost, minUpgradeCost, minUpgradeNode, minUpgradeWhat
        );

        if (nodeCost > 0 && (nodeCost < minUpgradeCost || minUpgradeCost == -1)) {
            if (nodeCost < availMoney) {
                const price = costFormat(nodeCost);
                lg.debug(1, "purchase node for %.2f%s$", price.cost, price.unit);
                ns.hacknet.purchaseNode();
                minUpgradeNode = -1;
                minUpgradeCost = -1;
                minUpgradeWhat = -1; // 0 level, 1 ram, 2 cpu
                productionRate = 0;
                nodeCost = numNodes < maxNumNodes ? ns.hacknet.getPurchaseNodeCost() : -1;
            }
        }
        else {
            if (minUpgradeCost < availMoney) {
                const price = costFormat(minUpgradeCost);
                switch(minUpgradeWhat) {
                    case 0:
                        lg.debug(1, "upgrade node %d level for %.2f%s$", minUpgradeNode, price.cost, price.unit);
                        ns.hacknet.upgradeLevel(minUpgradeNode, 1);
                        break;
                    case 1:
                        lg.debug(1, "upgrade node %d ram for %.2f%s$", minUpgradeNode, price.cost, price.unit);
                        ns.hacknet.upgradeRam(minUpgradeNode, 1);
                        break;
                    case 2:
                        lg.debug(1, "upgrade node %d cpu for %.2f%s$", minUpgradeNode, price.cost, price.unit);
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
    lg.log(1, "hack-net done, maximum nodes");

}
