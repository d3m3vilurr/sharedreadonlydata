var readonlytemplate;

try {
	readonlytemplate = require('../build/Release/readonlytemplate.node');
} catch(err) {
	try {
		readonlytemplate = require('../build/Debug/readonlytemplate.node');
	} catch(err) {
		readonlytemplate = require('../readonlytemplate.node');
	}
}
module.exports = new readonlytemplate.ReadOnlyTemplate();
