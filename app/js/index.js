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



console.log("Detecting serial devices...");
SerialPort.list().then(function(ports) {
    if(ports.length > 0) {
        console.log("Found device on port(s):");
        for(let p of ports) {
            console.log(p.path+" "+p.manufacturer+" "+p.vendorId+" "+p.productId);
        }
    } else {
        console.log("No devices detected.");
    }
});

