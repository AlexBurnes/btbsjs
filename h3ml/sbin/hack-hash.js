const Module  = '/h3ml/sbin/hack-hash.js';
const Version = '0.3.7.0'; // update this every time when edit the code!!!

/*
    Grow hacknet servers to max nodes and spend cachees for money or other goals

    to work need source file getOwnedSourceFiles() 9.1

*/
import {Constants}  from "/h3ml/lib/constants.js";
import {Servers}    from "/h3ml/lib/server-list.js";
import {Logger}     from "/h3ml/lib/log.js"
import {Units}      from "/h3ml/lib/units.js"
import {settings}   from "h3ml-settings.js";

const ms = Constants.ms;

const goalTypes = [
    "Money",
    "Hashes"
];
const goalTypeMoney  = 0;
const goalTypeHashes = 1;

async function version(ns, port) {
    if (port !== undefined && port) {
        const data = ns.sprintf("%d|%s|%s", Date.now(), Module, Version);
        return ns.tryWritePort(port, data);
    }
    ns.tprintf("module %s version %s", Module, Version);
    return;
}

/**
    @param {NS} ns
    @param {Number} port
**/
function help(ns) {
    ns.tprintf("usage: %s --version [--update-port] | --help", Module);
    ns.tprintf("this module is a library, import {some} from '%s'", Module); // in case of a library
    ns.tprintf("module description"); // in case of a module
    return;
}


////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////
// base class goal
class Goal {
    constructor (log, name) {
        this.log     = log;
        this.ns      = log.ns;
        this._type   = -1;
        this._amount = -1;
        this._hashes = -1;
        this.commit  = false;
        this._enable = true;
        this._name   = name;
    }
    get amount()       {if (!this.commit) this._select(); return this._amount;} // money is main unit to select what is min
    get hashes()       {if (!this.commit) this._select(); return this._hashes;}
    get type()         {if (!this.commit) this._select(); return this._type;}
    set amount(value)  {this._amount = value;} // money is main unit to select what is min
    set hashes(value)  {this._hashes = value;}
    set type(value)    {this._type   = value;}
    get name()         {return this._name;}

    async achieve() {
        if (!this.commit) return false;
        await this._commit();
    }

    // virtual

    enable(type) {
        this._enable = true;
    }

    disable(type) {
        this._disable = true;
        this.commit = false;
    }

    settings(type, n)  {
        return true
    };

    _select()     {return false;}
    _commit()     {return false;}
    desc()        {return "";}

};

////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////
// class goals
class Goals {
    constructor(log) {
        this.log        = log;
        this.ns         = log.ns;
        this.goals      = [];
        this.goalNames  = new Map();
        this.goal       = undefined;
        this._enable    = true;
    }
    select() {
        if (!this._enable) return;
        let goal = undefined;
        for(let i = 0; i < this.goals.length; i++) {
            if (this.goals[i].amount < 0) continue;
            if (goal == undefined) {
                goal = this.goals[i];
                continue;
            }
            if (goal.amount > this.goals[i].amount) {
                goal = this.goals[i];
            }
        }
        this.goal = goal;
        return goal;
    }
    push(goal) {
        this.goalNames[goal.name] = goal;
        this.goals.push(goal);
    }
    byname(name) {
        if (this.goalNames.has(name)) {
            return this.goalNames["get"](name);
        }
        return;
    }
    enable() {
        this._enable = true;
        this.goals.filter(goal => goal.name != "SellMoney" ).forEach(goal => goal.enable("all"));

    }
    disable() {
        this._enable = false;
        this.goals.forEach(goal => goal.disable("all"));
    }

    async achieve {
        const l = this.log;
        const ns = this.ns;

        if (!this._enable) {
            //even no money sell
            this.goal = undefined;
            return;
        }


        let goal = this.goal;
        if (goal == undefined) {
            goal = select();
            if (goal == undefined) {
                l.g("no goals for hack net");
                goal = byname("SellMoney");
                goal.enable();
            }
            l.g(1, "goal is %s", goal.desc());
        }

        const money  = ns.getServerMoneyAvailable("home");
        const hashes = ns.hacknet.numHashes();

        switch (goal.type) {
            case goalTypeMoney:
                if (hashes > goal.hashes) {
                    l.g(1, "hashes %f, sell for money", hashes);
                    await ns.hacknet.spendHashes("Sell for Money");
                    return;
                }
                if (money >= goal.amount) break;
                return;
            case goalTypeHashes:
                if (hashes >= goal.hashes) break;
                return;
            default:
                l.e("goal type is wrong, expect money or hashes, but have %d", goal.type);
                return;
        }

        // if we here then goal amounts is reached and needs commit goal
        await goal.achieve();
        goals.goal = undefined;
        return;

    }
}

////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////
// class upgrade node goal
class GoalUpgradeNode extends Goal {
    constructor(log, name, nodes = -1, level = -1, ram = -1, core = -1, cache = -1) {
        super(log, name);

        // constants
        this.upgradeNone  = -1;
        this.upgradeNode  = 0;
        this.upgradeLevel = 1;
        this.upgradeRam   = 2;
        this.upgradeCpu   = 3;
        this.upgradeCache = 4;
        this.upgrades = ["node", "level", "ram", "cpu", "cache"];

        this.what = this.upgradeNone;
        this.node = -1;
        this.maxNodes = nodes;
        this.maxLevel = level;
        this.maxRam   = ram;
        this.maxCore  = core;
        this.maxCache = cache;

    }
    desc() {
        return this.ns.sprintf("upgrade %s for %s", this.what == -1 ? "" : this.upgrades[this.what], Units.money(this.amount).pretty(this.ns));
    }
    upgrade_set(type, n) {
        switch (type) {
            case "max-node":
                this.maxNodes = n;
                break;
            case "max-level":
                this.maxLevel = n;
                break;
            case "max-ram":
                this.maxRam   = n;
                break;
            case "max-core":
                this.maxCore  = n;
                break;
            case "max-cache":
                this.maxCache = n;
                break;
        }
    }
    _select() {
        const ns = this.ns;
        const l  = this.log;

        const numNodes = ns.hacknet.numNodes();
        const nodeCost = numNodes < this.maxNodes ? ns.hacknet.getPurchaseNodeCost() : -1;

        const nodes = [];
        let productionRate = 0;
        for(let i = 0; i < numNodes; i++) {
            const node = ns.hacknet.getNodeStats(i);
            node.index = i;
            nodes[i] = node;
            productionRate += node.production;
        }
        l.g(1, "total nodes %d production rate %.2f", nodes.length, productionRate);

        let needUpgrade = false;
        let minUpgradeCost = -1;
        let minUpgradeNode = -1;
        let minUpgradeWhat = this.upgradeNode;

        const upgrade_fn = function(node, what, cost) {
            if (cost !== Infinity) {
                needUpgrade = true;
                if (minUpgradeCost == -1 || minUpgradeCost > cost) {
                    minUpgradeCost = cost;
                    minUpgradeNode = node.index;
                    minUpgradeWhat = what;
                }
            }
        };

        nodes
            .forEach( node => {
                l.d(1, "node[%d] level %d ram %d cpu %d, cache %d", node.index, node.level, node.ram, node.cores, node.cache);
                if (node.level < this.maxLevel || this.maxLevel == -1) upgrade_fn(node, this.upgradeLevel, ns.hacknet.getLevelUpgradeCost(node.index, 1));
                if (node.ram   < this.maxRam   || this.maxRam == -1)   upgrade_fn(node, this.upgradeRam,   ns.hacknet.getRamUpgradeCost(node.index,   1));
                if (node.cores < this.maxCore  || this.maxCore == -1)  upgrade_fn(node, this.upgradeCpu,   ns.hacknet.getCoreUpgradeCost(node.index,  1));
                if (node.cache < this.maxCache || this.maxCache == -1) upgrade_fn(node, this.upgradeCache, ns.hacknet.getCacheUpgradeCost(node.index, 1));
            });

        if (needUpgrade) {
            this.amount = minUpgradeCost;
            this.type   = goalTypeMoney;
            this.hashes = ns.hacknet.hashCost("Sell for Money");
            this.what   = minUpgradeWhat;
            this.node   = minUpgradeNode;
            this.commit = true;
        }
        else if (nodeCost > 0) {
            this.amount = nodeCost;
            this.type   = goalTypeMoney;
            this.hashes = ns.hacknet.hashCost("Sell for Money");
            this.what   = this.upgradeNode;
            this.node   = -1;
            this.commit = true;
        }
        else {
            this.amount = -1;
            this.hashes = -1;
            this.what   = -1;
            this.type   = -1;
            this.commit = false;
        }

        return this.commit;
    }
    async _commit() {
        const ns = this.ns;
        const l = this.log;
        if (!this.commit) return false;
        const price = Units.money(this.amount);
        switch(this.what) {
            case this.upgradeNode:
                l.g(1, "purchase node for %.2f%s$", price.amount, price.unit);
                await ns.hacknet.purchaseNode();
                break;
            case this.upgradeLevel:
                l.g(1, "upgrade node %d level for %.2f%s$", this.node, price.amount, price.unit);
                await ns.hacknet.upgradeLevel(this.node, 1);
                break;
            case this.upgradeRam:
                l.g(1, "upgrade node %d ram for %.2f%s$", this.node, price.amount, price.unit);
                await ns.hacknet.upgradeRam(this.node, 1);
                break;
            case this.upgradeCpu:
                l.g(1, "upgrade node %d cpu for %.2f%s$", this.node, price.amount, price.unit);
                await ns.hacknet.upgradeCore(this.node, 1);
                break;
            case this.upgradeCache:
                l.g(1, "upgrade node %d cache for %.2f%s$", this.node, price.amount, price.unit);
                await ns.hacknet.upgradeCache(this.node, 1);
                break;
        }
        this.commit = false;
        return true;
    }
};

////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////
// class spend hashes goal
class GoalSpendHashes extends Goal {
    constructor(log, name) {
        super(log, name);
        this.what = "";
        this.target = "";
        this.type = goalTypeHashes;
        this.hashSpends = [
            [ "Sell for Corporation Funds"        , false ],
            [ "Reduce Minimum Security"           , true  ],
            [ "Increase Maximum Money"            , true  ],
            [ "Improve Studying"                  , true  ],
            [ "Improve Gym Training"              , true  ],
            [ "Exchange for Corporation Research" , false ],
            [ "Exchange for Bladeburner Rank"     , false ],
            [ "Exchange for Bladeburner SP"       , false ],
            [ "Generate Coding Contract"          , false ]
        ];
        this.spendTypeCorp          = 0;
        this.spendTypeMinSec        = 1;
        this.spendTypeMaxMoney      = 2;
        this.spendTypeStudy         = 3;
        this.spendTypeGym           = 4;
        this.spendTypeResearch      = 5;
        this.spendTypeBladeRank     = 6;
        this.spendTypeBlaseSP       = 7;
        this.spendTypeContrcat      = 8;
        this.hashState = [];
        for(let i = 0; i < this.hashSpends.length; i++) {
            this.hashState[i] = this.hashSpends[i][1];
        }
    }
    desc() {
        return this.ns.sprintf("spend hashes %d for %s%s for %s", this.hashes, this.what, (this.target == undefined ? "" : " "+this.target), Units.money(this.amount).pretty(this.ns));
    }
    _select() {
        const ns = this.ns;
        const l = this.log;

        let spendHashes = -1;
        let spendOn = "";
        let target = "";

        const hacking_servers = new Map();
        Servers.list(ns).forEach(server => {
        const procs = ns.ps(server.name);
        procs
            .filter(proc => proc.filename.match(/server-hack(\-[^\.]+?)?\.js$/))
            .forEach(proc => {
                proc.args
                    .filter(arg => typeof(arg) == 'string' && !arg.match(/^--/))
                    .forEach(arg => {
                        hacking_servers.set(arg, true);
                        l.d(1, "set %s hack %s", server.name, arg);
                    })
            });
        });

        for(let i = 0; i < this.hashSpends.length; i++) {
            const hashSpend = this.hashSpends[i];
            if (this.hashState[i] == false) continue;

            switch (hashSpend[0]) {
                case "Reduce Minimum Security":
                    hacking_servers.forEach((value, server) => {
                        ns.print(server);
                        if (ns.getServerMinSecurityLevel(server) > 1) {
                            if (spendHashes == -1 || spendHashes > ns.hacknet.hashCost(hashSpend[0], server)) {
                                spendHashes = ns.hacknet.hashCost(hashSpend[0], server);
                                spendOn = hashSpend[0];
                                target = server;
                            }
                        }
                    });
                    //select hackable server
                    break;
                case "Increase Maximum Money":
                    //select hackable server
                    hacking_servers.forEach( (value, server) => {
                        if (spendHashes == -1 || spendHashes > ns.hacknet.hashCost(hashSpend[0], server)) {
                            spendHashes = ns.hacknet.hashCost(hashSpend[0], server);
                            spendOn = hashSpend[0];
                            target = server;
                        }
                    });
                    break;
                default:
                    if (spendHashes == -1 || spendHashes > ns.hacknet.hashCost(hashSpend[0])) {
                        spendHashes = ns.hacknet.hashCost(hashSpend[0]);
                        spendOn = hashSpend[0];
                        target = "";
                    }
            }
        }
        if (spendHashes > ns.hacknet.hashCapacity()) {
            this.commit = false;
            this.amount = -1;
        }
        else {
            this.what   = spendOn;
            this.target = target;
            this.hashes = spendHashes
            this.amount = (spendHashes/ns.hacknet.hashCost("Sell for Money")) * 10e6;
            this.commit = true;
        }
        return this.commit;

    }
    async _commit() {
        const ns = this.ns;
        const l = this.log;
        if (this.commit) {
            const price = Units.money(this.amount);
            l.g(1, "spend %d hashes on '%s'%s, money equivalent is %.2f%s$", this.hashes, this.what, (this.target == undefined ? "" : " "+this.target), price.amount, price.unit);
            let result;
            if (this.target == undefined) {
                result = await ns.hacknet.spendHashes(this.what);
            }
            else {
                result = await ns.hacknet.spendHashes(this.what, this.target);
            }
            if (result == false) {
                l.e("spend failed");
            }
        }
        this.commit = false;
        return true;
    }
    enable(type) {
        this._enable = true;
        switch (type) {
            case "all":
                for(let i = 0; i < this.hashSpends.length; i++) {
                    this.hashState[i] = this.hashSpends[i][1];
                }
                break;
            case "gym":
                this.hashState[this.spendTypeGym]           = true;
                this.hashSpends[i][this.spendTypeGym]       = true;
                break;
            case "study":
                this.hashState[this.spendTypeStudy]         = true;
                this.hashSpends[i][this.spendTypeStudy]     = true;
                break;
            case "server":
                this.hashState[this.spendTypeMinSec]       = true;
                this.hashSpends[i][this.spendTypeMinSec]   = true;
                this.hashState[this.spendTypeMaxMoney]     = true;
                this.hashSpends[i][this.spendTypeMaxMonry] = true;
                break;
        }
    }

    disable(type) {
        this._disable = true;
        this.commit = false;
        switch (type) {
            case "all":
                for(let i = 0; i < this.hashSpends.length; i++) {
                    this.hashState[i] = false;
                }
                break;
            case "gym":
                this.hashState[this.spendTypeGym]          = false;
                this.hashSpends[i][this.spendTypeGym]      = false;
                break;
            case "study":
                this.hashState[this.spendTypeStudy]        = false;
                this.hashSpends[i][this.spendTypeStudy]    = false;
                break;
            case "server":
                this.hashState[this.spendTypeMinSec]       = false;
                this.hashSpends[i][this.spendTypeMinSec]   = false;
                this.hashState[this.spendTypeMaxMoney]     = false;
                this.hashSpends[i][this.spendTypeMaxMonry] = false;
                break;

        }
    }

};

////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////
// class spend hashes for money
class GoalMoney extends Goal {
    constructor(log, name) {
        super(log, name);
        this.what    = "Sell for Money";
        this.amount  = 10e5;
        this.type    = goalTypeMoney;
        this.hashes  = this.ns.hacknet.hashCost(this.what);
        this._enable = false;
    }
    desc() {
        return this.ns.sprintf("sell for money %d", this.hashes);
    }
    _select() {
        if (this._enable) {
            return true;
        }
        return false;
    }
    async _commit() {
        if (!this._enable) {
            return false
        }
        return await ns.hacknet.spendHashes(this.what);
    }
}


////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////
// class spend hashes goal
class GoalUpgradeHome extends Goal {
    constructor(log, name) {
        super(log, name);
        this.what   = -1;
        this.type   = goalTypeMoney;
        this.hashes = this.ns.hacknet.hashCost("Sell for Money");
        this.upgradeRam  = 0;
        this.upgradeCore = 1;
    }
    desc() {
        return this.ns.sprintf("upgrade home %s for %s", this.what == this.upgradeRam ? "ram" : "cores", Units.money(this.amount).pretty(this.ns));
    }
    _select() {
        const ns = this.ns;
        const l = this.log;
        const core_cost = ns.getUpgradeHomeCoresCost();
        const ram_cost = ns.getUpgradeHomeRamCost();
        if (core_cost > ram_cost) {
            this.amount = core_cost;
            this.what = this.upgradeCore;
        }
        else {
            this.amount =ram_cost;
            this.what = this.upgradeRam;
        }
        this.commit = true;
    }
    _commit() {
        const ns = this.ns;
        const l = this.log;
        if (this.commit) {
            const price = Units.money(this.amount);
            switch (this.what) {
                case this.upgradeRam:
                    l.g(1, "upgrade home ram for %.2f%s$", price.amount, price.unit)
                    ns.upgradeHomeRam();
                    break;
                case this.upgradeCore:
                    l.g(1, "upgrade home core for %.2f%s$", price.amount, price.unit)
                    ns.upgradeHomeCore();
                    break;
            }
        }
        this.commit = false;
    }
};


////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////
// control of module

async function ctrl(time, data, goals) {
    const ns = l.ns;

    const [port, cmd, ...args] = data;

    const socket = new Socket(ns, port);

    l.g(1, "hacknet receive %s, port %d", cmd, data);

    switch (cmd) {
        case "max-nodes":
        case "max-level":
        case "max-core":
        case "max-cache":
        case "max-ram":
            upgrade_set(l, socket, cmd, args, goals);
            break;
        case "upgrade":
            upgrade_enable(l, socket, args, goals);
            break;
        case "stop":
            upgrade_stop(l, socket, args, goals);
            break;
        case "start":
            upgrade_start(l, socket, args, goals);
            break;
        case "money":
            upgrade_money(l, socket, args, goals);
            break;
        default:
            socket.write("#|Error|unknown command");
    }
    return 1;
}

function upgrade_set(l, socket, cmd, args, goals) {
    goals.byname("UpgradeNode").upgrade_set(cmd, args[0]);
}

function upgrade_start(l, socket, args, goals) {
    goals.enable();
    return 1;
}

function upgrade_stop(l, socket, args, goals) {
    goals.disable();
    return 1;
}

function upgrade_money(l, socket, args, goals) {
    goals.enable();
    goals.byname("SellMoney").enable();
    return 1;
}

function upgrade_enable(l, socket, args, goals) {
    const [enable, type, ...options] = args;
    if (enable == "disable") {
        switch (type) {
            case "all":
                goals.disable();
                break;
            case "home":
                goals.byname("UpgradeHome").disable(options);
                break;
            case "node":
                goals.byname("UpgradeNode").disable(options);
                break;
            case "server":
            case "study":
            case "gym":
            case "corp":
                goals.byname("SpendHashes").disable(options);
                break;
        }
    }
    if (enable == "enable") {
        switch (type) {
            case "all":
                goals.enable();
                break;
            case "home":
                goals.byname("UpgradeHome").enable(options);
                break;
            case "node":
                goals.byname("UpgradeNode").enable(options);
                break;
            case "server":
            case "study":
            case "gym":
            case "corp":
                goals.byname("SpendHashes").enable(options);
                break;
        }
    }
    return 1;
}




////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////
// info, maybe

async function info() {
    //need send settings back in form of
    /*
        "max-nodes":
        "max-level":
        "max-core":
        "max-cache":
        "max-ram":
        upgrade states
            node
            home
            study
            gym
            server
            corp
            ??
    */
    return 1;
}


////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////
// main
/** @param {NS} ns **/
export async function main(ns) {
    const args = ns.flags([
        [ 'version'     , false ],
        [ 'update-port' , 0     ],
        [ 'help'        , false ],
        [ 'log'         , 1     ], // log level - 0 quiet, 1 and more verbose
        [ 'debug'       , 1     ], // debug level
        [ 'verbose'     , false ], // verbose mode, short analog of --log-level 1
        [ 'quiet'       , true  ]  // quiet mode, short analog of --log-level 0

    ]);

    if (args['version']) {
        return version(ns, args['update-port']);
    }
    if (args['help']) {
        return help(ns);
    }

    const [nodes] = args["_"];
    const l = new Logger(ns, {args: args});

    // init goals
    const goals = new Goals(l);

    // goals for upgrade node
    goals.push(new GoalUpgradeNode(l, "UpgradeNode", nodes || -1));
    goals.push(new GoalSpendHashes(l, "SpendHashes"));
    goals.push(new GoalUpgradeHome(l, "UpgradeHome"));

    // other goals
    const goalMoney = new GoalMoney(l, "SellMoney");
    goalMoney.disable();
    goals.push(goalMoney);

    ns.disableLog("ALL");
    ns.clearLog();
    ns.tail();

    const socket = new Socket(l, Constants.nodePort);

    await socket.listen(
        async (time, data) => {
            switch (data.shift()) {
                case '@':
                    // ctrl
                    if (!await ctrl(time, data, goals))
                        return 0;
                    break;
                case '#':
                    //info to output
                    await info(time, data, goals);
            }
            return 1; //continue
        },
        {
            timeout: ms,
            idle: async () => {
                await goals.achieve();
                return 1;
            }
        }
    );

}
