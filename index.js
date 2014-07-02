var readonlydata = require('readonlydata');
var crc32 = require('crc-32');
var shm = require('shm');
var aumutex = require('aumutex');
var os = require('os');
var fs = require('fs');

var SharedReadOnlyData = function () {};
SharedReadOnlyData.prototype = new readonlydata.ReadOnlyData();

SharedReadOnlyData.prototype.init = function (keys, newSerializer, newDeserializer, fileName) {
	this.fileName = fileName;

	return readonlydata.ReadOnlyData.prototype.init.apply(this, arguments);
};

SharedReadOnlyData.prototype._insert = function _insert(key, element) {
	var serializedBuffer = this.serialize(element);
	var length = serializedBuffer.length;
	
	this.hints[key] = {cursor:this.cursor, length: length};

	this.buffer = this.ensureBufferSize(this.cursor + 4 + length);
	this.buffer.writeUInt32LE(length, this.cursor);
	this.cursor += 4;
	serializedBuffer.copy(this.buffer, this.cursor);
	this.cursor += length;
};

SharedReadOnlyData.prototype.ensureBufferSize = function ensureBufferSize(size) {
	if (this.buffer.length < size) {
		var newBuffer = new Buffer(this.buffer.length * 2);
		newBuffer.fill(0);
		this.buffer.copy(newBuffer);
		this.buffer = newBuffer;
	}
	return this.buffer;
};

SharedReadOnlyData.prototype.freeze = function freeze() {
	this.checksum = crc32.buf(this.buffer);
	return readonlydata.ReadOnlyData.prototype.freeze.apply(this, arguments);
};

SharedReadOnlyData.prototype.__get__ = function (idx) {
	var cursor = (this.hints[idx] || {}).cursor;
	var length = (this.hints[idx] || {}).length;
    
    if (!cursor || !length) return;

	if (!this.buffer) {
		var buffer = shm.readSHM(this.shmid, 8+cursor, 4+length);
		return this.deserialize(buffer, 0, length);

	} else {
		length = this.buffer.readUInt32LE(cursor);
		return this.deserialize(this.buffer, cursor, length);
	}
};

SharedReadOnlyData.prototype.writeSHM = function () {

	var self = this;

	if (os.platform() === 'win32' || os.platform() === 'win64') {
		this.shmkey = this.checksum;
	} else {
		this.shmkey = crc32.str(this.fileName);
	}

	var shmkey = this.shmkey;
	var mutexName = '/var/tmp/' + this.shmkey;
	var mutex = aumutex.create(mutexName);
	aumutex.enter(mutex);

	console.info('[readonlydata/' + process.pid +'] fname=' + this.fileName 
		+ ' chksum=' + this.checksum
		+ ' crc32(fname)=' + crc32.str(this.fileName)
		+ ' shmkey=' + this.shmkey);

	do {
		var shmid = openSHM_();
		if (!shmid) break;

		var buffer = shm.readSHM(shmid, 0, 8);
		var chksum = buffer.readDoubleLE(0);

		console.info('[readonlydata/' + process.pid +'] second chksum=' + chksum);

		if (chksum !== this.checksum) {
			if (!writeSHM_(shmid))
				break;			
		} else {
			console.info('[readonlydata/' + process.pid +'] already loaded');
		}

		this.shmid = shmid;
		this.buffer = null;

		console.info('[readonlydata/' + process.pid +'] shm complete. shmid=', shmid);

	} while (0);

	aumutex.close(mutex);

	function openSHM_() {
		var shmsize = self.buffer.length + 8;
		var shmkey = self.shmkey;

		var shmid = shm.openSHM(shmkey, 'c', 0, 8);
		if (!shmid) {
			console.error("shm.openSHM(size=8) error");
			return;
		};

		var buffer = shm.readSHM(shmid, 0, 8);
		var chksum = buffer.readDoubleLE(0);
		console.info('[readonlydata/' + process.pid +'] first shm chksum=' + chksum);

		if (chksum !== self.checksum) {			
			shm.deleteSHM(shmid);
			shm.closeSHM(shmid);
			shmid = shm.openSHM(shmkey, 'c', 0, shmsize);
			if (!shmid) {
				console.error("re-shm.openSHM error");
				return;
			};
			console.info('[readonlydata/' + process.pid +'] delete & reopen');
		}

		return shmid;
	}

	function writeSHM_(shmid) {
		var buffer = new Buffer(8);
		buffer.writeDoubleLE(self.checksum, 0);

		if (!shm.writeSHM(shmid, buffer, 0, buffer.length)
			|| !shm.writeSHM(shmid, self.buffer, 8, self.buffer.length)) {
			console.error("shm.writeSHM error");
			return;
		}

		return true;
	}
}

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

	var aReadOnlyData = new SharedReadOnlyData();
	aReadOnlyData.init(keys, serializer, deserializer, jsonFileName);

	var i, len = keys.length;
	for (i = 0; i < len; ++i) {
		aReadOnlyData._insert(keys[i], jsonData[keys[i]]);
	}
	jsonData = null;
	keys = null;

	aReadOnlyData.freeze();
	aReadOnlyData.writeSHM();	
	if (jsonFileName) {
		console.timeEnd(jsonFileName);
	}
	return aReadOnlyData;
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