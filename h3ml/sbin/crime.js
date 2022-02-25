const Module  = '/h3ml/sbin/crime.js';
const Version = '0.3.6.35'; // update this every time when edit the code!!!

import {Constants}   from "/h3ml/lib/constants.js";
import {Logger}      from "/h3ml/lib/log.js";
import {Table}       from "/h3ml/lib/utils.js";
import {Units}       from "/h3ml/lib/units.js";

const ms = Constants.ms;

/**
    @param {NS} ns
    @param {Number} port
**/
async function version(ns, port) {
    if (port !== undefined && port) {
        const data = ns.sprintf("%d|%s|%s", Date.now(), Module, Version);
        return ns.tryWritePort(port, data);
    }
    ns.tprintf("module %s version %s", Module, Version);
    return;
}

function help(ns) {
    ns.tprintf("usage: %s NAME [--debug] [--analyze] [--once] | --version [--update-port] | --help", Module);
    ns.tprintf("hack server NAME");
    return;
}

const crimes = [
      "Shoplift"
    , "Rob Store"
    , "Mug Someone"
    , "Larceny"
    , "Deal Drugs"
    , "Traffick Illegal Arms"
    , "Homicide"
    , "Grand Theft Auto"
    , "Kidnap"
    , "Assassination"
    , "Heist"
];

/** @param {NS} ns **/
export async function main(ns) {
    const args = ns.flags([
        [ 'version'     , false ],
        [ 'update-port' , 0     ],
        [ 'help'        , false ],
        [ 'log'         , 1     ], // log level - 0 quiet, 1 and more verbose
        [ 'debug'       , 0     ], // debug level
        [ 'verbose'     , false ], // verbose mode, short analog of --log-level 1
        [ 'quiet'       , true  ]  // quiet mode, short analog of --log-level 0
    ]);

    if (args['version']) {
        return version(ns, args['update-port']);
    }
    if (args['help']) {
        return help(ns);
    }

    ns.disableLog("ALL");
    ns.tail();

    const l = new Logger(ns, {args: args});

    const table = new Table(ns, [
        [ "    Name" , "%s"   ],
        [ "Chance"   , "%.2f" ],
        [ "Hack"     , "%.2f" ],
        [ "Srt"      , "%.2f" ],
        [ "Def"      , "%.2f" ],
        [ "Dex"      , "%.2f" ],
        [ "Agi"      , "%.2f" ],
        [ "Cha"      , "%.2f" ],
        [ "Int"      , "%.2f" ],
        [ "Karma"    , "%.2f" ],
        [ "Kill"     , "%.2f" ],
        [ "Money"    , "%s"   ],
        [ "Time"     , "%s"   ],
        [ "Rate"     , "%s"   ]
    ]);

    while (true) {
        let money_rate = 0;
        let best_crime = -1;

        // select best crime to commit
        for(let i = 0; i < crimes.length; i++) {
            const crime = crimes[i];
            if (ns.getCrimeChance(crime) < 1) continue;
            const stat = ns.getCrimeStats(crime);
            if (money_rate < stat.money / stat.time) {
                money_rate = stat.money / stat.time;
                best_crime = i;
            }
        }

        // output stat
        for(let i = 0; i < crimes.length; i++) {
            const crime = crimes[i];
            const stat = ns.getCrimeStats(crime);
            table.push(
                (i == best_crime ? "* " : "") + crime,
                ns.getCrimeChance(crime) * 100,
                stat.hacking_exp,
                stat.strength_exp,
                stat.defense_exp,
                stat.dexterity_exp,
                stat.agility_exp,
                stat.charisma_exp,
                stat.intelligence_exp,
                stat.karma,
                stat.kills,
                Units.money(stat.money).pretty(ns),
                Units.time(stat.time/ms).pretty(ns),
                Units.money((stat.money/stat.time)*ms).pretty(ns)
            );
        }
        ns.clearLog();
        l.g(1, table.print());

        // commit crime
        if (best_crime != -1 && !ns.isBusy()) {
            const stat = ns.getCrimeStats(crimes[best_crime]);
            await ns.commitCrime(crimes[best_crime]);
            await ns.sleep(stat.time);
            continue;
        }

        await ns.sleep(1000);

    }

}
