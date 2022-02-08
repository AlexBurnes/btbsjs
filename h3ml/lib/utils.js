const Module  = '/h3ml/lib/utils.js';
const Version = '0.3.5.11';     // update this every time when edit the code!!!

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
        return l.map((d, i, l) =>
            (i == 0 ? g[0] : i == 1 ? g[3] : g[2]) +  g[1].repeat(d + 1) + (i == l.length - 1 ? g[4] : "")
        ).join('')
    }

    /**
     * @params {String} g array of graph elements [left, gorizontal, cross, cross thin, right]
     * @params {Array}  l array of lengthes
     * @params {Array}  r array of data
     * @params {Number} a allign 0 left, 1 center, 2 right, default left
    **/
    header(g, l, r, a = 0) {
        return r.map((d, i, r, al = l[i] - d.length) =>
                (i <= 1 ? g[0] : g[2]) +
                this.ns.vsprintf("%s%s%s",
                    a == 0
                    ? [d, g[1].repeat(al), g[1]]
                    : a == 1
                        ? [g[1].repeat(al/2), d, g[1].repeat(al/2) + g[1].repeat(al%2)]
                        : [g[1].repeat(al), d, g[1]]
                ) +
                (i == r.length - 1 ? g[0] : "")
            ).join('');
    }

    /**
     * @params {String} g array of graph elements [left, gorizontal, cross, cross thin, right]
     * @params {Array}  l array of lengthes
     * @params {Array}  r array of rows of data
     * @params {Number} a allign 0 left, 1 center, 2 right, default left
    **/
    column(g, l, r, a = 0) {
        return r.map(r => this.header(g, l, r, a, k)).join("\n");
    }

    print() {
        const data = [
            this.border(this.graph[0], this.columns),                   // top
            this.header(this.graph[1], this.columns, this.headers),     // header
            this.border(this.graph[2], this.columns),                   // border
            this.column(this.graph[1], this.columns, this.rows, 2),     // rows
            this.border(this.graph[4], this.columns)                    // bottom
        ].join("\n");
        this.rows = [];  // clean rows
        return data;
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


export class _Dumper {
    constructor() {
        if (!_Dumper._intance) {
            _Dumper._instance = this;
        }
        return _Dumper._instance;
    }

    /*
        another way to define object identity
        (function() {
            var id_counter = 1;
            Object.defineProperty(Object.prototype, "__uniqueId", {
                writable: true
            });
            Object.defineProperty(Object.prototype, "uniqueId", {
                get: function() {
                    if (this.__uniqueId == undefined)
                        this.__uniqueId = id_counter++;
                    return this.__uniqueId;
                }
            });
        }());

    */
    // fixme decompose set id and check loop, map must contain both id and dump flag!
    _dumped(lvs, object) {
        if (lvs.map.has(object)) {
            return 1;
        }
        lvs.map.set(object, ++lvs.id);
        return 0;
    }

    _id(lvs, object) {
        if (lvs.map.has(object)) {
            return lvs.map["get"](object);
        }
        return 0;
    }

    // private
    _walk(object, lambda, filter, lvs, depth) {
        if (lvs == undefined) {
            lvs       = new Lvs();  // level pad
            lvs.map   = new Map();  // identity map object => id
            lvs.id    = 0;          // id of object identity
            lvs.items = 0;          // current dumping item number
            depth     = 1;          // curent dumping depth of object
            lambda(lvs.empty, typeof(object), object, lvs);
        }

        if (depth > this.maxDepth) {
            lambda(lvs.pad(depth, 1), 'too deep ...', '');
            return;
        }
        if (lvs.items++ >= this.maxItems) {
            if (lvs.items == this.maxItems) {
                lambda(lvs.pad(depth, 1), 'too many items ...', '');
            }
            return;
        }

        switch(typeof(object)) {
            case 'object':
                if (this._dumped(lvs, object)) {
                    return lambda(lvs.pad(depth, 1), object, 'already dumped ...');
                }

                const keys = Object.keys(object);
                for(let i=0; i < keys.length; i++) {
                    const child = object[keys[i]];
                    if (filter && !filter(keys[i])) continue;
                    if (child == undefined) {
                        lambda(lvs.pad(depth, i == keys.length-1 ? 1 : 0), keys[i], 'undefined');
                        continue;
                    }
                    lambda(lvs.pad(depth, i == keys.length-1 ? 1 : 0), keys[i], child);
                    if (typeof(child) == 'object') {
                        // deep down into rabbit hole
                        this._walk(child, lambda, filter, lvs, depth + 1);
                    }
                }
                break;
            case 'function':
                lambda(lvs.pad(depth, 1), typeof(object), '()');
                break;
            default:
                lambda(lvs.pad(depth, 1), typeof(object), object);
        }
    }

    //public
    dump(object, options = {}) {
        const data = [];
        this.maxDepth = options.depth || 10;
        this.maxItems = options.items || 1000;
        this._walk(object,
            (pad, name, object) => {
                const type = typeof(object);
                switch (typeof(object)) {
                    case 'object':
                        data.push(`${pad} ${name}:`);
                        break;
                    case 'function':
                        data.push(`${pad} ${name}()`);
                        break;
                    default:
                        data.push(`${pad} ${name} = ${object}`);
                }
            },
            options.filter
        );
        return data.join("\n");
    }
}

export const Dumper = new _Dumper;

/* example usage

    const test = {
        "one" : 1,
        "two" : [ 2, 3],
        "three": {
            "three-one": 1,
            "three-two": 2,
        }
    };
    //make loop
    test["four"] = test;
    ns.tprint(Dumper.dump(test));

    const unclickable = document.getElementById('unclickable');

    ns.tprint(Dumper.dump(unclickable, {filter: name => !name.match(/\_react/), depth: 2, items: 100}));

*/

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
    ns.tprintf("module %s version %s", Module, Version);
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
