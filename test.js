var sharedReadOnlyData = require('./index');
var assert = require('assert');
var sleep = require('sleep');

var a = {
	1: 1,
	a: 'a',
	b: {
		c: 'c',
		d: 2
	}
};

var aa = sharedReadOnlyData.createFrom(a, "JJ.JSON");
console.info(sharedReadOnlyData);
assert.deepEqual(aa.b, {c: 'c', d: 2});
console.info(Object.keys(aa));

//sleep.sleep(1*60*5);