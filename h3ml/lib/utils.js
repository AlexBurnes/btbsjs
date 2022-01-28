const Module  = '/h3ml/lib/utils.js';
const Version = '0.3.2.21';     // update this every time when edit the code!!!

import {Constants}  from "/h3ml/lib/constants.js";

////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////
// Level tree dumper
const graphEmpty    = '    ';
const graphContinue = ' │  ';
const graphItem     = ' ├──';
const graphLast     = ' └──';

export class LVS {
    constructor() {
    this.lvs = [];
    this.level = 0;
    }

    empty() {
    return graphEmpty;
    }

    pad(index, last) {
    let str = '';
    const S = this;
    if (S.lvs[index] != (last == 1 ? 0 : 1) || index != S.level) {
        S.lvs[index] = index ? last ? 0 : 1 : 0;
        S.level = index;
    }
    for(var i=0; i<=index-1; i++) {
        str += (S.lvs[i] ? graphContinue : graphEmpty);
    }
    str += (last ? graphLast : index ? graphItem : graphEmpty);
    return str;
    }
}

////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////
// TableFormatter
/*  @param {array[array[string]]} rows
    first row could be column names
    rows of column row
*/

/*
╔═╤═╦═╗
║ │ ║ ║
╠═╪═╬═╣
╟─┼─╫─╢
╚═╧═╩═╝
*/

export class TableFormatter {

    constructor(ns, columns) {
        this.ns = ns;

        this.headers = []; // column names
        this.formats = []; // column formats
        columns.forEach(
            column => {
                this.headers.push(column[0]);
                this.formats.push(column[1]);
            }
        );

        this.rows = []; // rows data
        this.columns = []; // column max sizes
        if (this.headers.length != this.formats.length) {
            throw new Error("number of column names and column formats not equals");
        }
        for(let i = 0; i < this.headers.length; i++) {
            this.columns[i] = this.headers[i].length;
        }
    }

    push(...row) {
        let data = [];
        for(let i = 0; i < row.length; i++) {
            if (this.formats[i] == undefined) {
                data[i] = typeof(row[i]) == "array" ? row[i].join(" ") : toString(row[i]);
            }
            else {
                data[i] = this.ns.vsprintf(this.formats[i], typeof(row[i]) == "object" ? row[i] : [row[i]]);
            }
            if (this.columns[i] == undefined || this.columns[i] < data[i].length) this.columns[i] = data[i].length;
        }
    this.rows.push(data);
    }

    print() {
        let border = "";
        for(let i = 0; i < this.columns.length; i++) {
            border += i == 0 ? "╔" : i == 1 ? "╦" : "╤";
            border += "═".repeat(this.columns[i] + 1);
            border += i == this.columns.length - 1 ? "╗" : "";
        }
        this.ns.tprintf("%s", border);

        let header = "";
        for(let i = 0; i < this.headers.length; i++) {
            header += i <= 1 ? "║" : "│";
            header += this.ns.vsprintf("%s%s ", [ this.headers[i], " ".repeat(this.columns[i] - this.headers[i].length) ]);
            header += i == this.headers.length - 1 ? "║" : "";
        }
        this.ns.tprintf("%s", header);

        border = "";
        for(let i = 0; i < this.columns.length; i++) {
            border += i == 0 ? "╠" : i == 1 ? "╬" : "╪";
            border += "═".repeat(this.columns[i] + 1);
            border += i == this.columns.length - 1 ? "╣" : "";
        }
        this.ns.tprintf("%s", border);

        border = "";
        for(let i = 0; i < this.columns.length; i++) {
            border += i == 0 ? "╟" : i == 1 ? "╫" : "┼";
            border += "─".repeat(this.columns[i] + 1);
            border += i == this.columns.length - 1 ? "╢" : "";
        }

        for(let i = 0; i < this.rows.length; i++) {
            let row = "";
            for(let j = 0; j < this.rows[i].length; j++) {
            row += j <= 1 ? "║" : "│";
            row += this.ns.vsprintf("%s%s ", [ " ".repeat(this.columns[j] - this.rows[i][j].length), this.rows[i][j] ]);
            row += j == this.rows[i].length - 1 ? "║" : "";
            }
            this.ns.tprintf("%s", row);
        }

        border = "";
        for(let i = 0; i < this.columns.length; i++) {
            border += i == 0 ? "╚" : i == 1 ? "╩" : "╧";
            border += "═".repeat(this.columns[i] + 1);
            border += i == this.columns.length - 1 ? "╝" : "";
        }
        this.ns.tprintf("%s", border);

        // clean rows
        this.rows = []; // rows data
        this.columns = []; // column max sizes
        for(let i = 0; i < this.headers.length; i++) {
            this.columns[i] = this.headers[i].length;
        }
    }
}

////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////
// Math round with precise
export function round(number, precise) {
    if (precise) {
        return number.toFixed(precise);
    }
    return Math.round(number);
}

////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////
// update-fetch support
/**
    @param {NS} ns
    @param {Number} port
**/
async function version(ns, port) {
    if (port !== undefined && port) {
        const data = ns.sprintf("%d|%s|%s", Date.now(), Module, Version);
        return ns.tryWritePort(port, data);
    }
    ns.tprintf("version %s", Version);
    return;
}

function help(ns) {
    ns.tprintf("usage: %s --version [--update-port] | --help", Module);
    ns.tprintf("this module is a library, import {some} from '%s'", Module); // in case of a library
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
    help();
    return;
}
