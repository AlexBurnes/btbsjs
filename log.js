// log.js logger
// version 0.1.0

export class Logger {
    constructor(ns, options = {}) {
        this.ns = ns;
        this.file = false;
        this.debugLevel = options["debugLevel"] || 0; //default debug level
        this.logLevel = options["logLevel"] || 1; //default log level
        if (options["name"] != undefined) {
            this.name = options["name"]; //file name
            this.mode = options["mode"] || "a";
            this.file = true;
            if (!this.name.match(/\.txt$/)) {
            this.name += ".txt";
            }
            //ns.tprintf("init log %s", this.name);
        }
    }
    _write(format, ...args) {
        //FIXME write only first string into file and thats all
        /*
        const now = new Date(Date.now());
        (async () => {
            return await this.ns.write(this.name, now.toUTCString() + ": " + this.ns.vsprintf(format, args), this.mode).resolve();
        });
        //this.ns.tprintf("write into log %s mode %s", this.name, this.mode);
        if (this.mode == "w") {
            this.mode = "a";
    }
    */
        return;
    }
    debug(level, format, ...args) {
        if (typeof(level) !== "number") throw Error("BUG: wrong usage of Logger.log(level, format, ..args), wrong type of argument level, expected number");
        if (this.debugLevel == 0 || level > this.debugLevel) return;
        if (this.file) {
            _write(format, args);
        }
        else {
            this.ns.tprintf("%s", this.ns.vsprintf(format, args));
        }
        return;
    }
    log(level, format, ...args) {
        if (typeof(level) !== "number") throw Error("BUG: wrong usage of Logger.log(level, format, ..args), wrong type of argument level, expected number");
        if (this.logLevel == 0 || level > this.logLevel) return;
        if (this.file) {
            _write(format, args);
        }
        else {
            this.ns.tprintf("%s", this.ns.vsprintf(format, args));
        }
        return;
    }

}
