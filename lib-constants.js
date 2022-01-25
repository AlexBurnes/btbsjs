const Module  = 'lib-constants.js';
const Version = '0.2.1'; // update this every time when edit the code!!!

const _reserveRam = 0;

const _protocolVersion  = 2; // version of protocol for iteract on botnet network
const _watchPort        = 1; // port number for updater
const _ctrlPort         = 2; // port number for receive ctrl data
const _infoPort         = 3; // reserved port for hacking.js, hack-servers.js
const _updatePort       = 4; // reserved port for updater.js

const _workerScriptFile = "worker.js";

class _Constants {
    constructor() {
        if (!_Constants._instance) {
            _Constants._instance = this
        }
        return _Constants._instansce;
    }
    get workerScriptFile()  {return _workerScriptFile};
    get reserveRam()        {return _reserveRam;}

    get protocolVersion()   {return _protocolVersion;}
    get watchPort()         {return _watchPort;}
    get updatePort()        {return _updatePort;}
    get ctrlPort()          {return _ctrlPort;}
    get infoPort()          {return _infoPort;}
}

export const Constants = new _Constants();

async function version(ns, port) {
    if (port !== undefined && port) {
        const data = ns.sprintf("%d|%d|%s|%s", Date.now(), _protocolVersion, Module, Version);
        return ns.tryWritePort(Constants.updatePort, data);
    }
    ns.tprintf("version %s", Version);
    return;
}

function help(ns) {
    ns.tprintf("usage: %s --version [--update-port] | --help", Module);
    ns.tprintf("this module is a library, import {Constants}} from '%s'", Module);
    return;
}

/** @param {NS} ns **/
export async function main(ns) {
    const args = ns.flags([
        [ 'version'         , false ],
        [ 'update-port'     , 0     ],
        [ 'help'            , false ]
    ]);

    if (args['version']) {
        return version(ns, args['update-port']);
    }
    if (args['help']) {
        return help(ns);
    }
}
