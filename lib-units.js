// version 0.1.0

const memoryUnits = ['b', 'k', 'M', 'G', 'T'];

class MemoryFormatted {
    constructor(value, size, unit) {
	this.value = value;
	this.size = size;
	this.unit = unit;
    }
}

export function memoryFormat(size) {
    const value = size;
    size = size;
    let unit = 0;
    const base = 1024;
    if (parseFloat(size) == "Infinity") return MemoryFormatted(0, 0, 'b');
    while (++unit < memoryUnits.length && Math.abs(size) >= base) size /= base;
    return new MemoryFormatted(value, value >= 0 ? size : -size, memoryUnits[--unit]);
}

const costUnits   = ['',  'k', 'm', 'b'];

class CostFormatted {
    constructor(value, cost, unit) {
	this.value = value;
	this.cost = cost;
	this.unit = unit
    }
}

export function costFormat(cost) {
    const value = cost;
    let unit = 0;
    const base = 1000;
    if (parseFloat(cost) == "Infinity") return CostFormatted(0, 0, '');
    while (++unit < costUnits.length && Math.abs(cost) >= base) cost /= base;
    return new CostFormatted(value, cost, costUnits[unit-1]);
}

const timeUnits = ['s', 'm', 'h', 'D', 'M', 'Y'];
const timeBases = [60,  60,  60,  24,  30,  12];

class TimeFormatted {
    constructor(value, time, unit) {
	this.value = value;
	this.time = time;
	this.unit = unit;
    }
}

export function timeFormat(time) {
    const value = time;
    let unit = 0;
    if (parseFloat(time) == "Infinity") return TimeFormatted(0, 0, 's');
    while (++unit < timeUnits.length && Math.abs(time) >= timeBases[unit-1]) time /= timeBases[unit-1];
    return new TimeFormatted(value, time, timeUnits[unit-1]);
}
