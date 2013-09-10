#!/usr/bin/env node

var childProcess = require('child_process'),
    phantomjs = require('phantomjs'),
    path = require('path'),
    binPath = phantomjs.path,
    debug = false,
    helium = require('./index'),
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
    } else if (args[i] === "-d" || args[i] === "--debug") {
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

helium(args.slice(2), function(err, output) {
    if(err) {
        if(output) {
            console.log('JSON Parse Error', err, output);
        }else {
            console.log(JSON.stringify(err, null, 4));
        }
        process.exit(1);
    }else {
        console.log(JSON.stringify(output, null, 4));
    }
}, debug);
