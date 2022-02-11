async function write_port(ns, ...data) {
    return await ns.tryWritePort(1, ns.sprintf("%d|%d|%s", Date.now(), 2, data.join('|')));
}

export async function main(ns) {
    const [target, method, time, host, threads, end, batch] = ns.args;
    const now = Date.now();
    if (time > now) await ns.sleep(time - now);

    const result = await ns[method](target);

    if (method == "hack") await write_port(ns, "<", host, time, threads, target, method, result, batch);

}

async function staticMemory(ns) {
    await ns.grow('');
}
