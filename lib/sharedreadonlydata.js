var crc32 = require('crc-32');
var shm = require('shm');
var aumutex = require('aumutex');
var os = require('os');
var ReadOnlyTemplate = require('./readonlytemplate');

function defaultSerializer(element) {
	var stringified = JSON.stringify(element);
	return new Buffer(stringified, 'utf-8');
}

function defaultDeserializer(buffer, cursor, length) {
	var stringified = buffer.toString('utf-8', cursor + 4, cursor + 4 + length);
	return JSON.parse(stringified);
}

var SharedReadOnlyData = ReadOnlyTemplate.create();
SharedReadOnlyData.prototype.init = function init(keys, newSerializer, newDeserializer, fileName) {
	Object.defineProperty(this, 'fileName', { value: fileName });
	Object.defineProperty(this, 'checksum', { value: 0, writable: true });
	Object.defineProperty(this, 'shmkey', { value: 0, writable: true });
	Object.defineProperty(this, 'shmid', { value: 0, writable: true });

	Object.defineProperty(this, 'serialize', { value: newSerializer || defaultSerializer });
	Object.defineProperty(this, 'deserialize', { value: newDeserializer || defaultDeserializer });
	Object.defineProperty(this, 'keys', { value: keys });
	Object.defineProperty(this, 'hints', { value: {}, writable: true });
	Object.defineProperty(this, 'buffer', { value: new Buffer(4 * 1024 * 1024), writable: true });
	Object.defineProperty(this, 'cursor', { value: 0, writable: true });
	this.buffer.writeUInt32LE(keys.length, 0);
	this.cursor = 4;
};

SharedReadOnlyData.prototype.freeze = function freeze() {
	this.checksum = crc32.buf(this.buffer);
	Object.defineProperty(this, 'frozen', { value: true });
	this.cursor = null;
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

SharedReadOnlyData.prototype.__set__ = function () {
	return false;
};

SharedReadOnlyData.prototype.__enum__ = function () {
	return this.keys;
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

		if (!shm.writeSHM(shmid, self.buffer, 8, self.buffer.length)
			|| !shm.writeSHM(shmid, buffer, 0, buffer.length)) {
			console.error("shm.writeSHM error");
			return;
		}

		return true;
	}
}

module.exports = SharedReadOnlyData;

