#!/usr/bin/env node

var childProcess = require('child_process'),
    phantomjs = require('phantomjs'),
    path = require('path'),
    binPath = phantomjs.path;

if (process.argv.length < 2) {
    console.error('Usage: helium-cli [URLs]\n\tPlease provide URLs!');
    process.exit(1);
}


var childArgs = [
    path.join(__dirname, 'helium-script.js'),
    path.join(__dirname, "curl.js")
];

Array.prototype.push.apply(childArgs, process.argv.slice(2));

childProcess.execFile(binPath, childArgs, function(err, stdout, stderr) {
    // handle results
    console.log(stderr);
    console.log(stdout);
});