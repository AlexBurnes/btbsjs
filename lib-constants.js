// lib-constants.js
// version 0.1.10

const _rootKitFiles = {
    "BruteSSH.exe"  : 1,
    "FTPCrack.exe"  : 2,
    "HTTPWorm.exe"  : 3,
    "relaySMTP.exe" : 4,
    "SQLInject.exe" : 5
};

const _workerScriptFile = "worker.js";

const _reserveRam = 16;

class _Constants {
    constructor() {
        if (!_Constants._instance) {
            _Constants._instance = this
        }
        return _Constants._instansce;
    }
    get workerScriptFile() {return _workerScriptFile};
    get rootKitFiles() {return _rootKitFiles};
    get reserveRam() {return _reserveRam;}
}

export const Constants = new _Constants();
