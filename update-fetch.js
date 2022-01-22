// update-fetch.js
// vesion 0.1.0

import {scriptFiles} from "file-list.js";
const baseUrl = 'https://raw.githubusercontent.com/AlexBurnes/btbsjs/master/';

/** @param {import("Ns").NS } ns */
export async function main(ns) {
    await update(ns);
}

/** @param {import("Ns").NS } ns */
async function update(ns) {
    for (let i = 0; i < scriptFiles.length; i++) {
        const file = `${scriptFiles[i]}.js`;

        ns.rm(`bk_${file}`);
        ns.cp(file, `bk_${file}`);

        await ns.wget(`${baseUrl}${file}`, `new_${file}`);
        if (!ns.fileExists(`new_${file}`)) {
            ns.print(`failed get file ${baseUrl}${file} as new_${file}`);
        }
        ns.print(`Got ${file} [${i + 1} / ${scriptFiles.length}]`);
    }
}
