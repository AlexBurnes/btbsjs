"use strict";
const Module  = '/h3ml/lib/constants.js';
const Version = '0.3.7.0'; // update this every time when edit the code!!!

import {settings}  from "/h3ml-settings.js";

const _rootKitFiles = {
    "BruteSSH.exe"  : 1,
    "FTPCrack.exe"  : 2,
    "HTTPWorm.exe"  : 3,
    "relaySMTP.exe" : 4,
    "SQLInject.exe" : 5
};

const _uGb = Math.pow(2, 20);
const _uMs = 1000;

const _logLevel     = settings.logLevel   || 1;    // default log level for all scripts
const _debugLevel   = settings.debugLevel || 0;    // default debug level for all scripts

const _workerScriptFile = "/h3ml/sbin/worker.js";
const _securityFile     = "/h3ml/etc/security.js";
const _serversFile      = "/h3ml/etc/servers.js";
const _scriptsFile      = "/h3ml/etc/scripts.js";
const _shareScriptFile  = "/h3ml/sbin/sharing.js";

const _reserveRam       = 0;
const _maxHomeCpuCores  = 8;

const _sapTimeout       = 100; // 100ms timeout between actions hack-weak, or grow-weak
const _gapTimeout       = 100; // 100ms timeout between group of action hw - gw - next cycle

const _protocolVersion  = 2; // version of protocol for iteract on botnet network

const _watchPort        = 1; // port number for recieve watch data
const _ctrlPort         = 2; // port number for receive ctrl data?
const _infoPort         = 3; // reserved port for hacking.js, hack-servers.js
const _updatePort       = 4; // reserved port for updater.js
const _stockPort        = 5; // reserved port for stock.js
const _setupPort        = 6; // reserved port for setup.js
const _nodePort         = 7; // reserved port for ctrl hacknet server
const _crimePort        = 8; // reseverd port for ctrl crime

// log toast
const _toastLogResult         = true;
const _toastResultTimeout     = 5000;

class _Constants {
    constructor() {
        if (!_Constants._instance) {
            _Constants._instance = this
        }
        return _Constants._instansce;
    }

    get version()               {return Version;}
    get logLevel()              {return _logLevel;}
    get debugLevel()            {return _debugLevel;}

    get uGb()                   {return _uGb;}
    get gb()                    {return _uGb;}
    get ms()                    {return _uMs;}

    get workerScriptFile()      {return _workerScriptFile;}
    get shareScriptFile()       {return _shareScriptFile;}
    get securityFile()          {return _securityFile;}
    get serversFile()           {return _serversFile;}
    get scriptsFile()           {return _scriptsFile;}

    get rootKitFiles()          {return _rootKitFiles;}
    get reserveRam()            {return _reserveRam;}
    get maxHomeCpuCores()       {return _maxHomeCpuCores;}
    get protocolVersion()       {return _protocolVersion;}
    get watchPort()             {return _watchPort;}
    get updatePort()            {return _updatePort;}
    get ctrlPort()              {return _ctrlPort;}
    get infoPort()              {return _infoPort;}
    get stockPort()             {return _stockPort;}
    get setupPort()             {return _setupPort;}
    get nodePort()              {return _nodePort;}
    get crimePort()             {return _crimePort;}

    get sapTimeout()            {return _sapTimeout;}
    get gapTimeout()            {return _gapTimeout;}

    get toastLogResult()        {return _toastLogResult;}
    get toastResultTimeout()    {return _toastResultTimeout;}
}

export const Constants = new _Constants();

async function version(ns, port) {
    if (port !== undefined && port) {
        const data = ns.sprintf("%d|%s|%s", Date.now(), Module, Version);
        return ns.tryWritePort(Constants.updatePort, data);
    }
    ns.tprintf("module %s version %s", Module, Version);
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
        [ 'version'     , false ],
        [ 'update-port' , 0     ],
        [ 'help'        , false ]
    ]);

    if (args['version']) {
        return version(ns, args['update-port']);
    }
    if (args['help']) {
        return help(ns);
    }
}
