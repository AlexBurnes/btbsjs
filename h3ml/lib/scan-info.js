// scan-info.js
// version 0.1.10

import {Constants} from "/h3ml/lib/constants.js"
import {serversTree} from "lib-server-list.js"
import {serverInfo} from "lib-server-info.js"
import {LVS} from "lib-utils.js"

export function serversTreePrint(ns, node, options, lvs) {
    if (lvs == undefined) {
        lvs = new LVS();
        ns.tprintf("%s %s", lvs.empty(), node.name);
    }
    for(let i=0; i < node.childs.length; i++) {
        const child = node.childs[i];
        const hackable = ns.getHackingLevel() > ns.getServerRequiredHackingLevel(child.name) ? 1 : 0
        const rootable = options["rootKits"] >= ns.getServerNumPortsRequired(child.name) ? 1 : 0;
        const rooted = ns.hasRootAccess(child.name) ? "🞕" : rootable ? "🞖" : "🞎";
        //FIXME checkBackDoor is installed
        const hacked = ns.getServer().backdoorInstalled == true ? "🞕" : hackable ? "🞖" : "🞎";
        //const backdoor = ns.getServer().backdoorInstalled ? "🞕" : hackable ? "🞖" : "🞎";

        ns.tprintf("%s %s %s %s %s",
            lvs.pad(child.depth, i == node.childs.length-1 ? 1 : 0),
            rooted,
            hacked,
            child.name,
            serverInfo(ns, child.name)
        );
        serversTreePrint(ns, child, options, lvs);
    }
}

/** @param {NS} ns **/
export async function main(ns) {
    const home = serversTree(ns);
    const rootKits = ns.ls('home').filter(f => Constants.rootKitFiles[f]).length;
    serversTreePrint(ns, home, {"rootKits": rootKits});
}
