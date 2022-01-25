import {Constants} from "lib-constants.js";
import {Socket} from "lib-network.js";

/** @param {NS} ns **/
export async function main(ns) {

    const module = "lib-network.js";
    const socket = new Socket(ns, Constants.updatePort);
    const module_version = await get_version(ns, socket, module);
    ns.tprintf("module %s version %s", module, module_version);
}

async function get_version(ns, socket, module) {
    const pid = ns.run(`${module}`, 1, "--version", "--update-port", Constants.updatePort);
    if (pid == 0) {
        ns.tprintf("failed to run '%s'", module);
        return;
    }
    const [time, data] = await socket.read({timeout: 1000});
    if (time == 0) {
        ns.tprintf("timeout occured");
        return;
    }
    return data;
}
