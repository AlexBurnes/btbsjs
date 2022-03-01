const Module  = '/h3ml/sbin/crime.js';
const Version = '0.3.7.0'; // update this every time when edit the code!!!

import {Constants}   from "/h3ml/lib/constants.js";
import {Logger}      from "/h3ml/lib/log.js";
import {Table}       from "/h3ml/lib/utils.js";
import {Units}       from "/h3ml/lib/units.js";
import {Socket}      from "/h3ml/lib/network.js";

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
    // Name                       Short           States true enable, false disable
    [ "Shoplift"                , "shop"        , true  ] ,
    [ "Rob Store"               , "rob"         , true  ] ,
    [ "Mug Someone"             , "mug"         , true  ] ,
    [ "Larceny"                 , "larceny"     , true  ] ,
    [ "Deal Drugs"              , "drugs"       , true  ] ,
    [ "Traffick Illegal Arms"   , "traffic"     , true  ] ,
    [ "Homicide"                , "homecide"    , false ] ,
    [ "Grand Theft Auto"        , "gta"         , true  ] ,
    [ "Kidnap"                  , "kidnap"      , false ] ,
    [ "Assassination"           , "assassin"    , true  ] ,
    [ "Heist"                   , "heist"       , true  ]
];

const crimeName         = 0;
const crimeShort        = 1;
const crimeState        = 2;

let crimeEnable = true;

async function crime (n) {
    let money_rate = 0;
    let best_crime = n;

    if (crimeEnable == false) return;

    if (best_crime == -1) {
        // select best crime to commit
        for(let i = 0; i < crimes.length; i++) {
            const crime = crimes[i];
            if (crime[crimeState] == false) continue;
            if (ns.getCrimeChance(crime[crimeName]) < 1) continue;
            const stat = ns.getCrimeStats(crime[crimeName]);
            if (money_rate < stat.money / stat.time) {
                money_rate = stat.money / stat.time;
                best_crime = i;
            }
        }
    }

    // output stat
    for(let i = 0; i < crimes.length; i++) {
        const crime = crimes[i];
        const stat = ns.getCrimeStats(crime[crimeName]);
        table.push(
            (crime[crimeState] == false ? "#" : i == best_crime ? "* " : "") + crime[crimeName],
            ns.getCrimeChance(crime[crimeName]) * 100,
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
        const stat = ns.getCrimeStats(crimes[best_crime][crimeName]);
        await ns.commitCrime(crimes[best_crime][crimeName]);
        await ns.sleep(stat.time);
        continue;
    }
}

////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////
// control of module

async function ctrl(time, data) {
    const ns = l.ns;

    const [port, cmd, ...args] = data;

    const socket = new Socket(ns, port);

    l.g(1, "crime receive %s, port %d", cmd, data);

    switch (data[1]) {
        case "start":
            crime_start(l, socket, args);
            break;
        case "stop":
            crime_stop(l, socket, args);
            break;
        case "commit":
            crime_commit(l, socket, args);
            break;
        case "enable":
            crime_toggle(l, socket, data[1], true, data[2]);
            break;
        case "disable":
            crime_disable(l, socket, data[1], false, data[2]);
            break;
        default:
            socket.write("#|Error|unknown command");
    }
    return 1;
}

////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////
// crime start
async function crime_start(l, socket, args) {
    crimeEnable = true;
    return await socket.write('#', 'OK', 'start', `start crime activity`);
}

////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////
// crime start
async function crime_stop(l, socket, args) {
    crimeEnable = false;
    return await socket.write('#', 'OK', 'stop', `stop all crime activity`);
}

////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////
// crime commit
async function crime_commit(l, socket, name) {
    // fixme if crime is not defined, commit once best crime
    const _crimeEnable = crimeEnable;
    crimeEnable = true;

    let n = -1;
    if (name == /\d+/) {
        n = parseInt(name);
        if (isNaN(n)) {
            return await socket.write('#', 'ERROR', action, `"wrong crime ${name} is not a number`);
        }
        if (n < 1 || n > crimes.length) {
            return await socket.write('#', 'ERROR', action, `"wrong crime number ${n}, expect 1..${crimes.length}`);
        }
        n--;
    }
    else {
        for(let i = 0; i < crimes.length; i++) {
            if (crimes[i][crimeShort] == name || crimes[i][crimeName] == name) {
                n = i;
            }
        }
        crimes.filter(crime => crime[crimeShort] == name || crime[crimeName] == name).forEach(crime => crime[crimeState] = enable)
    }
    if (name != undefined && n == -1) {
        return await socket.write('#', 'ERROR', 'commit', `wrong crime name ${name}`);
    }

    if (crime(n)) {
        await socket.write('#', 'OK', 'commit', `commit crime ${name}`);
    }
    else {
        await socket.write('#', 'ERROR', 'commit', `commit crime ${name}`);
    }
    crimeEnable = _crimeEnable;

}

////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////
// crime enable/disable
async function crime_toggle(l, socket, action, enable, name) {
    if (name == "all") {
        for(let i = 0; i < crimes.length; i++) {
            crimes[i][crimeState] = enable;
        }
    }
    else if (name == /\d+/) {
        const n = parseInt(name);
        if (isNaN(n)) {
            return await socket.write('#', 'ERROR', action, `"wrong crime ${name} is not a number`);
        }
        if (n < 1 || n > crimes.length) {
            return await socket.write('#', 'ERROR', action, `"wrong crime number ${n}, expect 1..${crimes.length}`);
        }
        crimes[n-1][crimeState] = enable;
    }
    else {
        crimes.filter(crime => crime[crimeShort] == name || crime[crimeName] == name).forEach(crime => crime[crimeState] = enable);
    }
    else {
        return await socket.write('#', 'ERROR', action, `wrong crime ${name}`);
    }
    return await socket.write('#', 'OK', action, `enable crime ${name}`);
}

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

    ns.disableLog("ALL");
    ns.clearLog();
    ns.tail();

    const socket = new Socket(l, Constants.crimePort);

    await socket.listen(
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
            timeout: ms,
            idle: async () => {
                await crime();
                return 1;
            }
        }
    );


}
