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
     * @return message data object (see createMessage for parameters)
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

}
