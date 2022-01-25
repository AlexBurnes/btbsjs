// hack-servers.js
// version 0.2.0

///////////////////////////////
// FIXME move to constants!  //
const protocolVersion   = 2; //
const receivePort       = 1; //
const ctrlPort          = 2; //
const listenPort        = 3; //
///////////////////////////////

const debugLevel        = 0;
const logLevel          = 1;


import { Logger } from "log.js"
import { serversList } from "lib-server-list.js"
import { BotNet } from "lib-botnet.js"
import { Target } from "target.js"
import { costFormat, timeFormat } from "lib-units.js"
import { TableFormatter } from "lib-utils.js"
import { updateInfo } from "lib-server-info-full.js"
import { hackServersInfo } from "lib-hack-server.js"

async function listHackingServers(lg, timeout) {
    const ns = lg.ns;
    const start = Date.now();
    await ns.tryWritePort(1, ns.sprintf("%d|%d|@|%d|server-hacking-list", start, protocolVersion, listenPort));
    while (Date.now() - start < timeout) { //wait 5 seconds
        const str = await ns.readPort(listenPort);
        if (str !== "NULL PORT DATA") {
            const [time, version, action, ...data] = str.split("|");
            if (time == undefined || version == undefined || version != protocolVersion) continue;
            lg.ld(1, "%d %s: %s", time, action, data.join(", "));
            if (action == "#") {
                if (data[0] == "server-hacking-list") {
                    const list = data[1].split(";").filter(server => !server.match(/^$/));
                    lg.ld(1, "hacking servers %d", list.length);
                    if (list.length > 0) {
                        list.forEach(server => lg.ld(1, "\t%s", server));
                    }
                    return list;
                }
            }

        }
        await ns.sleep(100);
    }
    return [];
}

/** @param {NS} ns **/
export async function main(ns) {
    const lg = new Logger(ns);

    const hacking_list = await listHackingServers(lg, 5000);
    const hacking_servers = new Map();
    hacking_list.forEach(item => {
        const server = item.split(",");
        const timeout = server[2] - Date.now() + parseInt(server[3]);
        const now = Date.now();
        const estimate = timeFormat(server[1] !== undefined && timeout > 0 ? timeout/1000 : 0);
        const diff_amount = costFormat(server[5]);
        const total_amount = costFormat(server[6]);
        const diff_security = server[7];
        const hack_info = [
            server[0],
            server[1],
            estimate,
            server[4],
            diff_amount,
            diff_security,
            total_amount
        ];
        //lg.ld(1, "\t%s data: %s", server[0], server.join(","));
        hacking_servers.set(server[0], hack_info);
    });

    const servers = serversList(ns)
        .filter(server => server.name !== 'home') // not home
        .filter(server => ns.getServerMaxMoney(server.name)) // has money
        .filter(server => ns.hasRootAccess(server.name)) // with root access
        .filter(server => ns.getServerRequiredHackingLevel(server.name) <= ns.getHackingLevel()); // hackable

    const botnet = new BotNet(ns);
    lg.lg(1, "botnet %d memory %dGb max threads %d, used memory %dGb usage %.2f%%",
        botnet.servers.length, botnet.maxRam, botnet.workers,
        botnet.usedRam, 100 * botnet.usedRam / botnet.maxRam
    );

    hackServersInfo(lg, botnet, servers, hacking_servers);

}
