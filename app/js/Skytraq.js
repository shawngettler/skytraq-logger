/**
 * Skytraq.js
 * @author @shawngettler
 *
 * Implemetation of the Skytraq Venu6 binary messgage protocol with priority on
 * the data-logging extension.
 */

export default class Skytraq {

    // system message ids
    static MSG_START = new Uint8Array([0xa0, 0xa1]);
    static MSG_END = new Uint8Array([0x0d, 0x0a]);

    static MSG_RESTART = new Uint8Array([0x01]);
    static MSG_GETVERSION = new Uint8Array([0x02]);
    static MSG_GETCRC = new Uint8Array([0x03]);
    static MSG_RESET = new Uint8Array([0x04]);
    static MSG_PORT = new Uint8Array([0x05]);

    static MSG_VERSION = new Uint8Array([0x80]);
    static MSG_CRC = new Uint8Array([0x81]);
    static MSG_ACK = new Uint8Array([0x83]);
    static MSG_NACK = new Uint8Array([0x84]);

    // logger message ids
    static MSG_LOG_GETSTATUS = new Uint8Array([0x17]);
    static MSG_LOG_CONFIG = new Uint8Array([0x18]);
    static MSG_LOG_CLEAR = new Uint8Array([0x19]);
    static MSG_LOG_GETDATA = new Uint8Array([0x1d]);

    static MSG_LOG_STATUS = new Uint8Array([0x94]);

    // logger data header
    static HDR_EMPTY = new Uint8Array([0x07]);
    static HDR_FULL = new Uint8Array([0x02]);
    static HDR_COMPACT = new Uint8Array([0x04]);
    static HDR_POI = new Uint8Array([0x03]);



    /**
     * Create new logger device.
     *
     * @param writeCallback callback to promise function which writes to the serial port
     */
    constructor(writeCallback) {
        this.write = writeCallback;

        this.dataBuffer = new Uint8Array();


        // utility method for finding multi-byte sequences in the buffer
        Uint8Array.prototype.indexOfArray = function(searchArray, fromIndex) {
            fromIndex = fromIndex || 0;
            if(fromIndex + searchArray.length > this.length)
                return -1;
            for(let i = 0; i < searchArray.length; i++)
                if(this[fromIndex + i] != searchArray[i])
                    return this.indexOfArray(searchArray, fromIndex + 1);
            return fromIndex;
        };

    }


    /**
     * Append new data to the end of the buffer.
     *
     * @param data byte array
     */
    appendData(data) {
        let currentBuffer = this.dataBuffer.slice();
        this.dataBuffer = new Uint8Array(currentBuffer.length + data.length);
        this.dataBuffer.set(currentBuffer, 0);
        this.dataBuffer.set(data, currentBuffer.length);
    }

    /**
     * Remove data from the beginning of the buffer.
     *
     * @param removeCount number of bytes to remove
     *
     * @return byte array
     */
    removeData(removeCount) {
        let d = this.dataBuffer.slice(0, removeCount);
        this.dataBuffer = this.dataBuffer.slice(removeCount);
        return d;
    }


    /**
     * Read a specified number of bytes from the buffer.
     *
     * @param readCount number of bytes to read
     *
     * @return promise which resolves with a data byte array
     */
    readData(readCount) {
        return new Promise((resolve, reject) => {
            let read = function() {
                if(this.dataBuffer.length < readCount)
                    setTimeout(read, 100);
                else
                    resolve(this.removeData(readCount));
            }.bind(this);
            read();
        });
    }

    /**
     * Read the next binary message from the buffer.
     *
     * @return promise which resolves with a binary message byte array
     */
    readMessage() {
        return new Promise((resolve, reject) => {
            let read = function() {
                let endIndex = this.dataBuffer.indexOfArray(Skytraq.MSG_END);
                if(endIndex == -1) {
                    setTimeout(read, 100);
                } else {
                    let m = this.removeData(endIndex + 2);
                    if(m.indexOfArray(Skytraq.MSG_START) == 0)
                        resolve(m);
                    else
                        read();
                }
            }.bind(this);
            read();
        });
    }


    /**
     * Query the device.
     *
     * @param query binary message query
     *
     * @return promise which resolves if the device returns the correct ack
     */
    getQuery(query) {
        return new Promise((resolve, reject) => {
            this.write(Skytraq.encodeMessage(query))
                .then(() => { return this.readMessage(); })
                .then((m) => {
                    let msg = Skytraq.decodeMessage(m);
                    if(msg.id == Skytraq.MSG_ACK && msg.body[0] == 0)
                        return this.readMessage();
                })
                .then((m) => {
                    let msg = Skytraq.decodeMessage(m);
                    if(msg.id == Skytraq.MSG_ACK && msg.body[0] == query.id)
                        resolve();
                })
                .catch(reject);
        });
    }

    /**
     * Request the device software version.
     *
     * @return promise which resolves with a binary message
     */
    getSoftwareVersion() {
        return new Promise((resolve, reject) => {
            this.getQuery({
                id: Skytraq.MSG_GETVERSION,
                body: new Uint8Array()
            })
                .then(() => { return this.readMessage(); })
                .then((m) => {
                    let msg = Skytraq.decodeMessage(m);
                    resolve({
                        kernelVersion: msg.body[2]+"."+msg.body[3]+"."+msg.body[4],
                        odmVersion: msg.body[6]+"."+msg.body[7]+"."+msg.body[8],
                        revision: msg.body[10]+"/"+msg.body[11]+"/"+msg.body[12]
                    });
                })
                .catch(reject)
        });
    }

    /**
     * Request the logger status of the device.
     *
     * @return promise which resolves with a binary message
     */
    getLoggerStatus() {
        return new Promise((resolve, reject) => {
            this.getQuery({
                id: Skytraq.MSG_LOG_GETSTATUS,
                body: new Uint8Array()
            })
                .then(() => { return this.readMessage(); })
                .then((m) => {
                    let msg = Skytraq.decodeMessage(m);
                    resolve({
                        position: msg.body[0] | (msg.body[1] << 8) | (msg.body[2] << 16) | (msg.body[3] << 24),
                        secLeft: msg.body[4] | (msg.body[5] << 8),
                        secTotal: msg.body[6] | (msg.body[7] << 8),
                        maxTime: msg.body[8] | (msg.body[9] << 8) | (msg.body[10] << 16) | (msg.body[11] << 24),
                        minTime: msg.body[12] | (msg.body[13] << 8) | (msg.body[14] << 16) | (msg.body[15] << 24),
                        maxDist: msg.body[16] | (msg.body[17] << 8) | (msg.body[18] << 16) | (msg.body[19] << 24),
                        minDist: msg.body[20] | (msg.body[21] << 8) | (msg.body[22] << 16) | (msg.body[23] << 24),
                        maxSpeed: msg.body[24] | (msg.body[25] << 8) | (msg.body[26] << 16) | (msg.body[27] << 24),
                        minSpeed: msg.body[28] | (msg.body[29] << 8) | (msg.body[30] << 16) | (msg.body[31] << 24),
                        datalog: msg.body[32] == 1,
                        fifomode: msg.body[33] == 1
                    });
                })
                .catch(reject);
        });
    }


    /**
     * Download logger data.
     *
     * @param secStart starting sector
     * @param secCount number of sectors to read
     *
     * @return promise which resolves with data byte array
     */
    getLoggerData(secStart, secCount) {
        return new Promise((resolve, reject) => {
            this.getQuery({
                id: Skytraq.MSG_LOG_GETDATA,
                body: new Uint8Array([(secStart >> 8) & 0xff, secStart & 0xff, (secCount >> 8) & 0xff, secCount & 0xff])
            })
                .then(() => { return this.readData(secCount * 4096 + 19); })
                .then((d) => {
                    let data = d.slice(0, secCount * 4096);
                    resolve(data);
                })
                .catch(reject);
        });
    }


    /**
     * Encode Skytraq binary message.
     *
     * @param msg message data object
     * @param msg.id message id byte array
     * @param msg.body message body byte array
     *
     * @return binary message byte array
     */
    static encodeMessage(msg) {
        let plLen = 1 + msg.body.length;
        let plChk = msg.id;
        for(let b of msg.body)
            plChk = plChk ^ b;

        let m = new Uint8Array(8 + msg.body.length);
        m.set(Skytraq.MSG_START, 0);
        m.set(new Uint8Array([plLen >> 8, plLen & 0xff]), 2);
        m.set(msg.id, 4);
        m.set(msg.body, 5);
        m.set(new Uint8Array([plChk]), 5 + msg.body.length);
        m.set(Skytraq.MSG_END, 6 + msg.body.length);
        return m;
    }

    /**
     * Decode a Skytraq binary message. Returned object has an additional
     * "check" parameter indicating whether the message checksum matches.
     *
     * @param m binary message byte array
     *
     * @return message data object (see encodeMessage for parameters)
     */
    static decodeMessage(m) {
        let plLen = (m[2] << 8) + m[3];
        let msg = { id: m[4], body: m.slice(5, 5 + plLen - 1) };

        let plChk = msg.id;
        for(let b of msg.body)
            plChk = plChk ^ b;

        msg.check = m[5 + msg.body.length] == plChk;
        return msg;
    }


    /**
     * Decode Skytraq position fix information from logger binary data.
     *
     * @param data data byte array
     *
     * @return array of ECEF position objects
     */
    static decodeBinaryData(data) {
        // weird 10-bit signed int conversion
        const getInt10 = (b) => { return b & 0x200 ? 0x1ff - b : b; };

        let points = [];
        let curPos = 0;
        do {
            let h = data[curPos] >> 5;
            if(h == Skytraq.HDR_FULL || h == Skytraq.HDR_POI) {
                let d = data.slice(curPos, curPos + 18);
                points.push({
                    poi: h == Skytraq.HDR_POI,
                    velocity: ((d[0] & 0x03) << 8) | d[1],
                    gpsWeek: ((d[2] & 0x03) << 8) | d[3],
                    gpsTime: (d[2] >> 4) | (d[4] << 12) | (d[5] << 4),
                    // js automatically makes these signed 32-bit ints
                    x: (d[6] << 8 ) | d[7] | (d[8] << 24) | (d[9] << 16),
                    y: (d[10] << 8 ) | d[11] | (d[12] << 24) | (d[13] << 16),
                    z: (d[14] << 8 ) | d[15] | (d[16] << 24) | (d[17] << 16)
                });
                curPos += 18;
            } else if(h == Skytraq.HDR_COMPACT) {
                let d = data.slice(curPos, curPos + 8);
                let p = points[points.length - 1];
                points.push({
                    poi: false,
                    velocity: ((d[0] & 0x03) << 8) | d[1],
                    gpsWeek: p.gpsWeek,
                    gpsTime: p.gpsTime + ((d[2] << 8) | d[3]),
                    x: p.x + getInt10((d[4] << 2) | (d[5] >> 6)),
                    y: p.y + getInt10((d[5] & 0x3f) | ((d[6] & 0xf0) << 6)),
                    z: p.z + getInt10(((d[6] & 0x03) << 8) | d[7])
                });
                curPos += 8;
            } else if(h == Skytraq.HDR_EMPTY) {
                curPos += 2;
            }
        } while(curPos < data.length);

        return points;
    }

}
