
async function write_port(ns, ...data) {
    return await ns.tryWritePort(1, ns.sprintf("%d|%d|%s", Date.now(), 2, data.join('|')));
}

export async function main(ns) {
    const [target, method, time, host, threads, end, batch] = ns.args;

    if (time > Date.now()) await ns.sleep(time - Date.now());

    await write_port(ns, ">", host, time, threads, target, method, end, batch);

    const result = await ns[method](target);

    await write_port(ns, "<", host, time, threads, target, method, result, batch);

}

async function staticMemory(ns) {
    await ns.grow('');
}
