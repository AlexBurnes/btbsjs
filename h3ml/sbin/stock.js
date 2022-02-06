const Module  = '/h3ml/sbin/stock.js';
const Version = '0.3.5.4'; // update this every time when edit the code!!!

import {Constants}  from "/h3ml/lib/constants.js";
import {Logger}     from "/h3ml/lib/log.js"
import {Units}      from "/h3ml/lib/units.js";
import {Table}      from "/h3ml/lib/utils.js";

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
    ns.tprintf("usage: %s | --version [--update-port] | --help", Module);
    ns.tprintf("buy/sell stock auto trade module");
    return;
}

class Symbol {
    constructor(ns, name) {
        this.ns     = ns;
        this.st     = ns.stock;
        this.name   = name;
        this.signal = "";
        this.time   = 0;
        this.forecast  = st.getForecast(name)*100;
        const position = st.getPosition(name);
        this.price  = position[1];
        this.shares = position[0];
        this.total  = 0;
    }
}

class _Stock {
    constructor() {
        if (!_Stock._instance) {
            _Stock._instance = this
        }
        return _Stock._instansce;
    }

    init(l) {
        this.lg = l;
        this.ns = l.ns;
        this.st = ns.stoock;
        this.socket = new Socket(this.ns, Constants.stockPort);
        this.maxNameLength = 0;
        this.symbols_ = new Map();
        Object.keys(serversData)
            .forEach(name => {
                const server = serversData[name];
                if (server.maxMoney > 0) {
                    this.maxNameLength = Math.max(name.length, this.maxNameLength);
                }
            });
        l.d(1, "max length name %d", this.maxNameLength);

        const symbols = this.st.getSymbols();
        this.symbols_ = new Map();

        symbols.forEach(s => {
            const data = new Symbol(ns, s);
            this.symbols_.set(s, data);
            this.maxNameLength = Math.max(name.length, this.maxNameLength);

        });


    }

    get symbols {return this.symbols_;}

}

const Stock = new _Stock;

async function ctrl(time, data) {
    const ns = l.ns;

    const [port, cmd, ...args] = data;

    const socket = new Socket(ns, port);

    l.g(1, "stock receive %s, port %d", cmd, data);

    switch (data[1]) {
        case "start-trade":
            trade_start(l, socket, args);
            break;
        case "stop-trade":
            trade_stop(l, socket, args);
            break;
        case "sell-all":
            sell_all(l, socket, args);

        default:
            socket.write("#|Error|unknown command");
    }
    return 1;
}

async function info() {
}

async function trade(l, table, symbols) {

    const ns = l.ns;
    const st = ns.stock;

    ns.clearLog();

    let avgVolityle = 0;
    let avgForecast = 0;
    let totalProfit = 0;
    let totalAmount = 0;
    let totalTotal  = 0;

    symbols.forEach(symb => {
        const data = Stock.symbols["get"](symb);

        const forecast = st.getForecast(symb)*100;
        const position = st.getPosition(symb);
        data.price = position[1];
        data.shares = position[0];

        const signal =
            (data.forecast > 50 && forecast < 50 || (false && forecast < 50 && data.forecast > forecast))
            ? "sell"
            : (data.forecast < 50 && forecast > 50 || (false && forecast > 50 && data.forecast < forecast))
            ? "buy"
            : "";
        data.forecast = forecast;
        if (signal !== "") {
            data.signal = signal;
            data.time = Date.now();
            if (signal == "buy") {
                // how many shares to buy, minimum 100k / (volataly * askPrice)
                const minShares = Math.ceil(100e3 / (st.getVolatility(symb)*st.getAskPrice(symb)));
                const allowShares = (ns.getServerMoneyAvailable("home")*0.1)/st.getAskPrice(symb);
                const maxShares = st.getMaxShares(symb);
                l.d(1, "shares min %d, allow %d, max %d", minShares, allowShares, maxShares);
                if (allowShares > minShares) {
                    const shares = Math.min(allowShares, maxShares);
                    l.d(1, "buy shares %d", shares);
                    data.price = st.buy(symb, shares);
                    if (data.price) {
                        data.shares += shares;
                    }
                }
            }
            else {
                if (data.shares > 0) {
                    l.d(1, "sell shares %d", data.shares);
                    const price = st.sell(symb, data.shares);
                    if (price) {
                        const profit = (price - data.price) * data.shares;
                        data.total += profit;
                        data.shares = 0;
                        ns.toast(ns.sprintf("%s %s", symb, Units.money(profit).pretty(ns)), profit > 0 ? "success" : "error", 30000);
                    }
                }
            }
        }
        // let signal show 60 seconds
        if (data.time && data.time + 60000 < Date.now()) {
            data.signal = "";
            data.time = 0;
        }

        //do something with wrong postition
        if (forecast < 50 && data.shares > 0) {
            // sell stocks
            l.d(1, "sell shares %d", data.shares);
            const price = st.sell(symb, data.shares);
            if (price) {
                const profit = (price - data.price) * data.shares;
                data.total += profit;
                data.shares = 0;
                ns.toast(ns.sprintf("%s %s", symb, Units.money(profit).pretty(ns)), profit > 0 ? "success" : "error", 30000);
            }
        }

        const profit = position[0] > 0 ? (st.getBidPrice(symb) - position[1])*position[0] : 0;
        const amount = st.getSaleGain(symb, data.shares, "Long");
        const volityle = st.getVolatility(symb);
        avgVolityle += volityle;
        avgForecast += forecast;
        totalProfit += profit;
        totalAmount += amount;
        totalTotal  += data.total;

        table.push(
            symb,
            Units.money(st.getAskPrice(symb)).pretty(ns),
            Units.money(st.getBidPrice(symb)).pretty(ns),
            volityle*100,
            Units.money(st.getMaxShares(symb)).pretty(ns),
            Units.money(st.getAskPrice(symb)*st.getMaxShares(symb)).pretty(ns),
            forecast,
            (forecast > 50 ? "+" : forecast == 50 ? "." : "-").repeat(Math.abs(forecast-50)/10+1),
            data.signal,
            Units.money(data.shares).pretty(ns),
            Units.money(profit).pretty(ns),
            Units.money(amount).pretty(ns),
            Units.money(data.total).pretty(ns)
        );
    });
    avgForecast /= symbols.length
    table.push(
        "Total",
        "",
        "",
        (avgVolityle/symbols.length)*100,
        "",
        "",
        (avgForecast),
        (avgForecast > 50 ? "+" : avgForecast == 50 ? "." : "-").repeat(Math.abs(avgForecast-50)/10+1),
        "",
        "",
        Units.money(totalProfit).pretty(ns),
        Units.money(totalAmount).pretty(ns),
        Units.money(totalTotal).pretty(ns)
    );

    ns.print(table.print());

    return 1;

}

/** @param {NS} ns **/
export async function main(ns) {
    const args = ns.flags([
        [ 'version'     , false ],
        [ 'update-port' , 0     ],
        [ 'help'        , false ],
        [ 'log'         , 1     ], // log level - 0 quiet, 1 and more verbose
        [ 'debug'       , 0     ], // debug level
        [ 'verbose'     , true  ], // verbose mode, short analog of --log-level 1
        [ 'quiet'       , false ]  // quiet mode, short analog of --log-level 0

    ]);

    if (args['version']) {
        return version(ns, args['update-port']);
    }
    if (args['help']) {
        return help(ns);
    }

    // for modules
    const l = new Logger(ns, {args: args});

    ns.disableLog("ALL");

    ns.tail(Module);

    Stock.init(l);

    const table = new Table(ns, [
        [ "    Sym"    ,   "%s"   ],
        [ "Ask"        ,   "%s"   ],
        [ "Bid"        ,   "%s"   ],
        [ "Vl"         ,   "%.2f" ],
        [ "mSh"        ,   "%s"   ],
        [ "mMn"        ,   "%s"   ],
        [ "F"          ,   "%.2f" ],
        [ "D"          ,   "%s"   ],
        [ "Signal"     ,   "%s"   ],
        [ "Shares"     ,   "%s"   ],
        [ "Profit"     ,   "%s"   ],
        [ "Amount"     ,   "%s"   ],
        [ "Total"      ,   "%s"   ]
    ]);

    const symbols = Stock.symbols.keys();
    symbols.sort((a, b) => {return a > b});

    // drop all old events
    let oldTime = Date.now();
    l.d(1, "time %d", oldTime);

    await Stock.socket.listen(
        async (time, data) => {
            switch (data.shift()) {
                case '@':
                    // ctrl
                    if (!await ctrl(time, data))
                        return 0;
                    break;
                case '#':
                    //info to output
                    await info(time, data);
            }
            return 1; //continue
        },
        {
            timeout: 1000,
            idle: async () => {
                await trade(l, table, symbols);
                return 1;
            }
        }
    );


    return;
}
