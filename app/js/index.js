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
command.parse(process.argv);


/*
 * List connected serial devices.
 */
if(command.listDevices) {
    console.log("Detecting serial devices...");
    SerialPort.list().then(function(ports) {
        if(ports.length > 0) {
            console.log("Found device on port(s):");
            for(let p of ports) {
                console.log(p.path);
            }
        } else {
            console.log("No devices detected.");
        }
        process.exit(0);
    });
}
