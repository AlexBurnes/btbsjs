// scan-simple.js
// version 0.1.0

import {LVS} from "lib-utils.js"
import {serversTree} from "lib-server-list.js"

export function serversTreePrint(ns, node, lvs) {
    if (lvs == undefined) {
        lvs = new LVS();
        ns.tprintf("%s %s", lvs.empty(), node.name);
    }
    for(let i=0; i < node.childs.length; i++) {
        const child = node.childs[i];
        ns.tprintf("%s %s",
            lvs.pad(child.depth, i == node.childs.length-1 ? 1 : 0),
            child.name
        );
    serversTreePrint(ns, child, lvs);
    }
}

/** @param {NS} ns **/
export async function main(ns) {
    const home = serversTree(ns);
    serversTreePrint(ns, home);
}
