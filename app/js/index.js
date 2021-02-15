#!/usr/bin/env node

/**
 * index.js
 * @author @shawngettler
 *
 * Utility for Skytraq-based GPS logger.
 */

"use strict";



import Skytraq from "./Skytraq.js";

// npm modules
import SerialPort from "serialport";
import Commander from "commander";



/*
 * Parse command line options.
 */
const command = new Commander.Command();
command.option("-l, --list-devices", "list serial devices");
command.option("--status", "display logger status");
command.option("--binary <file>", "save logger data in Skytraq binary format");
command.option("--geojson <file>", "save logger data in GeoJSON format");
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
    const serial = new SerialPort(command.port, { autoOpen: false });
    serial.on("error", (err) => { console.log(err); });

    // wrap serianport in promises
    const serialOpen = () => {
        console.log("Connecting to device on port "+command.port);
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

    // device
    const skytraq = new Skytraq(serialWrite);
    serial.on("data", (data) => { skytraq.appendData(data); });

    // run
    serialOpen()
        .then(() => skytraq.getSoftwareVersion())
        .then((m) => {
            console.log("Connected to device running software version " + m.kernelVersion);
        })
        .then(() => skytraq.getLoggerStatus())
        .then((m) => {
            if(command.status) {
                console.log("Logger status:");
                console.log("  "+(m.secTotal-m.secLeft)*4+"kB used of "+m.secTotal*4+"kB available");
                if(m.minTime > 0)
                    console.log("  time interval "+m.minTime+"s");
                if(m.minDist > 0)
                    console.log("  distance interval "+m.minDist+"m");
            }
        })
        .then(() => serial.close())
        .catch(console.log);

}
