// lib-utils.js
// version 0.1.0

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

// TableFormatter
/*	@param {array[array[string]]} rows
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
    
    constructor(ns, headers, formats) {
	this.ns = ns;
	this.headers = headers; // column names
	this.formats = formats; // column formats
	this.rows = [];	// rows data
	this.columns = []; // column max sizes
	if (headers.length != formats.length) {
	    throw new Error("number of column names and column formats not equals");
	}
	for(let i = 0; i < headers.length; i++) {
	    this.columns[i] = headers[i].length;
	}
    }
    
    push(...row) {
	let data = [];
	//this.ns.tprintf("table push row %d", this.rows.length);
	for(let i = 0; i < row.length; i++) {
	    /*this.ns.tprintf("[%d] format '%s' data type %s: %s", i, this.formats[i], typeof(row[i]),
		typeof(row[i]) == "object" ? row[i].join(",") : toString(row[i])
	    );*/
	    if (this.formats[i] == undefined) {
		data[i] = typeof(row[i]) == "array" ? row[i].join(" ") : toString(row[i]);
	    }
	    else {
		data[i] = this.ns.vsprintf(this.formats[i], typeof(row[i]) == "object" ? row[i] : [row[i]]);
	    }
	    if (this.columns[i] == undefined || this.columns[i] < data[i].length) 
		this.columns[i] = data[i].length;
	    //this.ns.tprintf("[%d] %s", i, data[i]);
	}
	this.rows.push(data);
    }

    print() {
	//print header
	//FIXME write table borders
	//this.ns.tprintf("table print rows %d * columns %d", this.rows.length, this.columns.length);

	// print upper
	let border = "";
	for(let i = 0; i < this.columns.length; i++) {
	    border += i == 0 ? "╔" : i == 1 ? "╦" : "╤";
	    border += "═".repeat(this.columns[i] + 1);
	    border += i == this.columns.length - 1 ? "╗" : "";
	}
	this.ns.tprintf("%s", border);
	
	let	header = "";
	for(let i = 0; i < this.headers.length; i++) {
	    //this.ns.tprintf("[%d], length %d, '%s'", i, this.columns[i], this.headers[i]);
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
	    //do not print, to many space used
	    //if (i > 0) this.ns.tprintf(border);

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
    }
}

// Math round with precise
export function round(number, precise) {
    if (precise) {
	return number.toFixed(precise);
    }
    return Math.round(number);
}