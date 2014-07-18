var SharedReadOnlyData = require('./lib/sharedreadonlydata');
var fs = require('fs');

var serializer;
var deserializer;

function require_(jsonFileName) {
	var rawData = fs.readFileSync(jsonFileName);
	var jsonData = JSON.parse(rawData);
	return createFrom(jsonData, jsonFileName, rawData);
}

function createFrom(jsonData, jsonFileName, rawData) {
	if (jsonFileName) {
		console.time(jsonFileName);
	}

	var keys = Object.keys(jsonData);

	var aSharedReadOnlyData = new SharedReadOnlyData();
	aSharedReadOnlyData.init(keys, serializer, deserializer, jsonFileName);

	var i, len = keys.length;
	for (i = 0; i < len; ++i) {
		aSharedReadOnlyData._insert(keys[i], jsonData[keys[i]]);
	}
	jsonData = null;
	keys = null;

	aSharedReadOnlyData.freeze();
	aSharedReadOnlyData.writeSHM();	
	if (jsonFileName) {
		console.timeEnd(jsonFileName);
	}
	return aSharedReadOnlyData;
}

function overrideSerializer(newSerializer, newDeserializer) {
	if (!newSerializer && !newDeserializer) throw Error('serializer/deserializer both needeed');
	if (serializer || deserializer) throw Error('called twice');
	serializer = newSerializer;
	deserializer = newDeserializer;
}

exports.require = require_;
exports.createFrom = createFrom;
exports.overrideSerializer = overrideSerializer;