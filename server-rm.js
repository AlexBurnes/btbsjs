// server-rm.js
// version 0.1.0

/** @param {NS} ns **/
export async function main(ns) {
    const [name] = ns.args;

    const servers = ns.getPurchasedServers();
    if (servers.filter(s => s == name).length) {

	const promptText = ns.vsprintf("delete server '%s' size of %dGb?", [name, ns.getServerMaxRam(name)]);
	if (await ns.prompt(promptText)) {
	    if (ns.deleteServer(name)) {
		ns.tprintf("ok server '%s' removed", name);
	    }
	    else {
		ns.tprintf("failed to delete server '%s'", name);
	    }
	}
	else {
	    ns.tprintf("user cancel buy");
	}		
	return;
    }

    ns.tprintf("threre is no server with this name %s", name);
    return;
}

/**
 * @param {{servers: any[]}} data
 * @param {any[]} args
 * @returns {*[]}
 */
export function autocomplete(data, args) {
    return [...data.servers];
}