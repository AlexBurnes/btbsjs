// server-buy.js
// version 0.1.0

import {memoryFormat, moneyFormat} from "lib-units.js";
import {serversList} from "lib-server-list.js";

const UnitGb = Math.pow(2, 30);

/** @param {NS} ns **/
export async function main(ns) {

    const [name, requestSizeGb] = ns.args;

    const maxServers = ns.getPurchasedServerLimit();
    const servers = ns.getPurchasedServers();
    if (servers.filter(s => s == name).length) {
        ns.tprintf("already have server this name %s", name);
        return;
    }

    const hosts = serversList(ns);
    if (hosts.filter(s => s.name == name).length) {
        ns.tprintf("threre is a server with this name %s", name);
        return;
    }

    if (servers.length - 1 < maxServers) {
        ns.tprintf("could buy %d more servers", maxServers - (servers.length - 1));
    }
    else {
        ns.tprintf("bought maximum servers %d", maxServers);
    }

    const serverPrice = ns.getPurchasedServerCost(requestSizeGb);
    const priceFmt = moneyFormat(serverPrice);

    const promptText = ns.vsprintf("buy server size of %dGb price is %.2f%s?", [requestSizeGb, priceFmt.amount, priceFmt.unit]);
    if (await ns.prompt(promptText)) {
        const server_name = ns.purchaseServer(name, requestSizeGb);
        if (server_name !== "") {
            ns.tprintf("ok new server %s", server_name);
        }
        else {
            ns.tprintf("failed to buy server");
        }
    }
    else {
        ns.tprintf("user cancel buy");
    }
}
