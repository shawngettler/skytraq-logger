#!/usr/bin/env node

/**
 * index.js
 * @author @shawngettler
 *
 * Utility for Skytraq-based GPS logger.
 */

"use strict";



// npm modules
import SerialPort from "serialport";
import Commander from "commander";



/*
 * Parse command line options.
 */
const command = new Commander.Command();
command.option("-l, --list-devices", "list serial devices");
command.arguments("[port]");
command.action((port) => { command.port = port; });
command.parse(process.argv);


/*
 * List connected serial devices.
 */
if(command.listDevices) {
    console.log("Detecting serial devices...");
    SerialPort.list()
        .then((ports) => {
            if(ports.length > 0) {
                console.log("Found device on port(s):");
                for(let p of ports)
                    console.log(p.path);
            } else {
                console.log("No devices detected.");
            }
            process.exit(0);
        });
}


/*
 * Connect to the device and run utility.
 */
if(command.port) {
    console.log("Connecting to device on port "+command.port);
    const serial = new SerialPort(command.port, { autoOpen: false });
    serial.on("error", (err) => { console.log(err); });

    // wrap serianport in promises
    const serialOpen = () => {
        return new Promise((resolve, reject) => {
            serial.open(resolve);
        });
    };
    const serialWrite = (m) => {
        return new Promise((resolve, reject) => {
            serial.write(m);
            serial.drain(resolve);
        });
    };

}
