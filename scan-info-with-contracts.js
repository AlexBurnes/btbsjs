// scan-info-with-contracts.js
// version 0.1.0

import {rootKitFiles} from "lib-constants.js"
import {LVS} from "lib-utils.js"
import {serversTree} from "lib-server-list.js"
import {serverInfo} from "lib-server-info.js"

export function serversTreePrint(ns, node, options, lvs) {
    if (lvs == undefined) {
	lvs = new LVS();
	ns.tprintf("%s %s", lvs.empty(), node.name);
    }
    
    const contracts = ns.ls(node.name, ".cct");
    for(let i=0; i < contracts.length; i++) {
	const contract = contracts[i];
	ns.tprintf("%s © %s %s", 
	    lvs.pad(node.depth + 1, node.childs == 0 && i == contracts.length -1 ? 1 : 0),
	    contract, ns.codingcontract.getContractType(contract, node.name)
	);
    }

    for(let i=0; i < node.childs.length; i++) {
	const child = node.childs[i];
	
	const hackable = ns.getHackingLevel() > ns.getServerRequiredHackingLevel(child.name) ? 1 : 0
	const rootable = options["rootKits"] >= ns.getServerNumPortsRequired(child.name) ? 1 : 0;
	const rooted = ns.hasRootAccess(child.name) ? "🞕" : rootable ? "🞖" : "🞎";
	//FIXME checkBackDoor is installed
	const hacked = ns.getServer(child.name).backdoorInstalled == true ? "🞕" : hackable ? "🞖" : "🞎";
	//const hacked = ns.hasRootAccess(child.name) && hackable ? "🞕" : hackable ? "🞖" : "🞎";

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

export async function main(ns) {
    const home = serversTree(ns);
    const rootKits = ns.ls('home').filter(f => rootKitFiles[f]).length;
    serversTreePrint(ns, home, {"rootKits": rootKits});
}
