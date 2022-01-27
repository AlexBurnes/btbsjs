// version 0.1.0

export class Server {
    constructor(name, depth, parent) {
        this.name  = name;
        this.depth = depth;
        this.childs = [];
        this.parent = parent;
    }
}

/**
 * @param {import("Ns").NS } ns
 * @returns {Server[]} depth is 1-indexed
 */
export function serversList(ns) {
    const list = [];
    const visited = {'home': 1};
    const queue = Object.keys(visited);
    while (queue.length > 0) {
        const host = queue.pop();
        const current = new Server(host, visited[host]);
        list.push(current);
        ns.scan(current.name)
            .reverse()
            .filter(e => !visited[e])
            .forEach(server => {
            queue.push(server);
            current.childs.push(server);
            visited[server] = visited[host] + 1;
            });
        }
    return list;
}

/**
 * @param {import("Ns").NS } ns
 * @returns {Server} home
 */

export function serversTree(ns) {
    const root = new Server('home', 0);
    const visited = {'home': root};
    const queue = Object.keys(visited);
    while (queue.length > 0) {
    const host = queue.pop();
    const node = visited[host];
    ns.scan(host)
        .filter(e => !visited[e])
        .forEach(child => {
            const server = new Server(child, node.depth+1, node);
            queue.push(server.name);
            node.childs.push(server);
            visited[server.name] = server;
        });
    }
    return root;
}
