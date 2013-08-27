#!/usr/bin/env node

var childProcess = require('child_process'),
    phantomjs = require('phantomjs'),
    path = require('path'),
    binPath = phantomjs.path,
    debug = false,
    args = Array.prototype.concat.call(process.argv);


for (var i = 0; i < args.length; ++i) {
    if (args[i] === "-h" || args[i] === "--help") {
        console.error('Usage: helium-cli [URLs]');
        console.error('\t-h, --help show help');
        console.error('\t-v, --version show version');
        process.exit(1);
    } else if (args[i] === "-v" || args[i] === "--version") {
        console.log(require('./package.json').version);
        process.exit(1);
    } else if (args[i] === "-d" || args[i] === "--version") {
        debug = true;
        args.splice(i, 1);
        i--;
    }
}

if (args.length < 2) {
    console.error('Usage: helium-cli [URLs]\n\tPlease provide URLs!');
    console.error('\t-h, --help show help');
    console.error('\t-v, --version show version');
    process.exit(1);
}

var childArgs = [
    path.join(__dirname, 'helium-script.js'),
    path.join(__dirname, "curl.js")
];

Array.prototype.push.apply(childArgs, args.slice(2));

if (debug) console.log(binPath, '\n', childArgs);

var ph = childProcess.spawn(binPath, childArgs);
ph.stdout.setEncoding('utf8');
ph.stderr.setEncoding('utf8');

ph.stdout.on('data', function(data) {
    console.log(data);
});

ph.stderr.on('data', function(data) {
    if (debug) console.log(data);
});

ph.on('close', function(code) {
    process.exit(code);
});