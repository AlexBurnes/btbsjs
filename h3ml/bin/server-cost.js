// server-cost.js
// version 0.1.0

import {memoryFormat, moneyFormat} from "lib-units.js";

const UnitGb = Math.pow(2, 30);

/** @param {NS} ns **/
export async function main(ns) {
    const [requestSizeGb] = ns.args;
    const minSizeGb = typeof (requestSizeGb) === 'number' ? requestSizeGb : 1;
    const maxSizeGb = typeof (requestSizeGb) === 'number' ? requestSizeGb : Math.pow(2, 20);
    let i = 0;
    for(let sizeGb=minSizeGb; sizeGb <= maxSizeGb; sizeGb*=2) {
        const costFmt = moneyFormat(ns.getPurchasedServerCost(sizeGb));
        const sizeFmt = memoryFormat(sizeGb * UnitGb);
        ns.tprintf("\t%d%s (2^%d %dG) cost %0.2f%s",
            sizeFmt.size, sizeFmt.unit, i++, sizeGb, costFmt.amount, costFmt.unit
        );
    }
}
