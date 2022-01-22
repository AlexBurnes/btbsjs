// scan.js
// version 0.1.0

/** @param {NS} ns **/
export async function main(ns) {
    const scripts = [
        'scan-simple', 'scan-info', 'scan-info-with-contracts'
    ];

    const availMemory = ns.getServerMaxRam("home") - ns.getServerUsedRam("home");
    let pid;
    scripts.reverse().forEach(f => {
        if (!pid) {
            const scriptMem = ns.getScriptRam(f + '.js');
            if (scriptMem <= availMemory) {
            pid = ns.run(f + '.js', 1);
            }
        }
    });
    if (!pid) {
        ns.tprintf("not enought memory on host to run scan");
    }

}
