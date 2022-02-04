const Module  = '/h3ml/lib/utils.js';
const Version = '0.3.4.17';     // update this every time when edit the code!!!

////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////
// Level tree dumper
export class Lvs {
    constructor() {
        this.lv = [];   // vector of levels
        this.l  = 0;    // current level
    }

    get empty()  {return '    ';}
    get trunk()  {return ' │  ';}
    get branch() {return ' ├──';}
    get leaf()   {return ' └──';}

    /**
     * @params {Number} i index
     * @params {Number} l last
     * @return {String}
    **/
    pad(i, l) {
        const t = this;
        if (t.lv[i] != (l ? 0 : 1) || i != t.l) {
            t.lv[i] = i ? l ? 0 : 1 : 0;
            t.l = i;
        }
        return t.empty + t.lv.slice(0, i).map(l => l ? t.trunk : t.empty).join('') + (l ? t.leaf : i ? t.branch : t.empty);
    }
}

////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////
// Table

/** default graph of table is array of rows 5x5: top, column-border, header-border, row-border, bottom **/
/** each row is array of graph elements: left, filler, cross, cross thin, right **/
const tableGraph = [
    "╔═╤╦╗",
    "║ │║║",
    "╠═╪╬╣",
    "╟─┼╫╢",
    "╚═╧╩╝"
];

export class Table {

    constructor(ns, columns, graph = tableGraph) {
        this.ns = ns;
        this.headers = []; // column names
        this.formats = []; // column formats
        this.graph = graph;
        columns.forEach(
            column => {
                this.headers.push(column[0]);
                this.formats.push(column[1]);
            }
        );

        this.rows    = []; // rows data
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

    /**
     * @params {String} g array of graph elements [left, gorizontal, cross, cross thin, right]
     * @params {Array}  l array of lengthes
    **/
    border(g, l) {
        let row = '';
        for(let i = 0; i < l.length; i++) {
            row += i == 0 ? g[0] : i == 1 ? g[3] : g[2];
            row += g[1].repeat(l[i] + 1);
            row += i == l.length - 1 ? g[4] : "";
        }
        this.ns.tprintf("%s", row);
    }

    /**
     * @params {String} g array of graph elements [left, gorizontal, cross, cross thin, right]
     * @params {Array}  l array of lengthes
     * @params {Array}  r array of data
     * @params {Number} a allign 0 left, 1 center, 2 right, default left
    **/

    //FIXME possible trouble with ord length, 1/2 0 1 ok, 0 0 1 ok, 2 1 1, 3 1 2
    header(g, l, r, a = 0) {
        let row = '';
        for(let i = 0; i < r.length; i++) {
            row += i <= 1 ? g[0] : g[2];
            const al = l[i] - r[i].length;
            row += this.ns.vsprintf("%s%s%s",
                  a == 0
                ? [ r[i],               g[1].repeat(al), " "]
                : a == 1
                ? [ g[1].repeat(al/2),  r[i],            g[1].repeat(al/2) + g[1].repeat(al%2)]
                : [ g[1].repeat(al),    r[i],            " "]
                //FIXME align center
            );
            row += i == r.length - 1 ? g[0] : "";
        }
        this.ns.tprintf("%s", row);
    }
    /**
     * @params {String} g array of graph elements [left, gorizontal, cross, cross thin, right]
     * @params {Array}  l array of lengthes
     * @params {Array}  r array of rows of data
     * @params {Number} a allign 0 left, 1 center, 2 right, default left
    **/

    column(g, l, r, a = 0) {
        r.forEach(r => this.header(g, l, r, a));
    }

    print() {
        this.border(this.graph[0], this.columns);                   // top
        this.header(this.graph[1], this.columns, this.headers);     // header
        this.border(this.graph[2], this.columns);                   // border
        this.column(this.graph[1], this.columns, this.rows, 2);     // rows
        this.border(this.graph[4], this.columns);                   // bottom
        this.rows = [];  // clean rows
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
