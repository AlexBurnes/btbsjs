/** @param {NS} ns **/
export async function main(ns) {
    const host = ns.getHostname();
    const args = ns.args;

    let cmd = args.shift();
    let pattern = '.*';
    if (cmd == "|") {
        cmd = args.shift();
        if (cmd = "grep") {
            pattern = args.shift();

        }
    }

    const max_items = 100;
    const re = new RegExp(pattern);

    const procs = ns.ps(host);
    const filtered = procs.filter(proc => proc.filename.match(re) || proc.args.join('').match(re));
    if (filtered.length > 0) {
        for(let i = 0; i < Math.min(filtered.length, max_items); i++) {
            const proc = filtered[i];
            ns.tprintf("%d %s %s", proc.pid, proc.filename, proc.args.join(' '));
        }
        if (filtered.length > max_items) {
            ns.tprintf("... more %d", filtered.length - max_items);
        }
    }
    else {
        ns.tprintf("no procs running on %s", host);
    }


}
