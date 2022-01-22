// version 0.1.0
import {costFormat} from "lib-units.js"
import {round} from "lib-utils.js"

/** @param {NS} ns
 *  @param {string} name
 *  @return {Array{string}}
**/
export function serverInfo(ns, name) {
    const moneyAvail = costFormat(ns.getServerMoneyAvailable(name));
    const moneyMax   = costFormat(ns.getServerMaxMoney(name));

    return [
        "[",  ns.getServerRequiredHackingLevel(name),
        ", ", ns.getServerNumPortsRequired(name),
        "] ",
        ns.getServerMaxRam(name), "Gb",
        " ", round(moneyAvail.cost, 2), moneyAvail.unit,
        "$ / ", round(moneyMax.cost, 2), moneyMax.unit,
        "$ (",
        moneyMax ? round((100 * moneyAvail.value / moneyMax.value), 2) : 0,
        "%)"
    ].join("");
}
