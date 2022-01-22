// update-fetch.js
// vesion 0.1.5

import {scriptFiles} from "file-list.js";
const baseUrl = 'https://raw.githubusercontent.com/AlexBurnes/btbsjs/master/';

/** @param {import("Ns").NS } ns */
export async function main(ns) {
    await update(ns);
}

/** @param {import("Ns").NS } ns */
async function update(ns) {
    const host = ns.getHostname();
    ns.tprintf("update %d files", scriptFiles.length);
    for (let i = 0; i < scriptFiles.length; i++) {
        const file = `${scriptFiles[i]}`;

        ns.tprintf("[%d/%d] get file %s", i+1, scriptFiles.length, file);

        ns.rm(`bk_${file}`);
        if (ns.fileExists(`${file}`, host)) {
            ns.mv(host, `${file}`, `bk_${file}`);
        }

        await ns.wget(`${baseUrl}${file}`, `${file}`);
        if (!ns.fileExists(`${file}`, host)) {
            ns.tprintf("[%d/%d] failed get file %s%s as %s", i+1, scriptFiles.length, baseUrl, file, file);
            continue;
        }
        ns.tprintf("[%d/%d] got file %s success", i+1, scriptFiles.length, file);
    }
}
