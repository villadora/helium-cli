#!/usr/bin/env node

var childProcess = require('child_process'),
    phantomjs = require('phantomjs'),
    path = require('path'),
    binPath = phantomjs.path,
    debug = false,
    silence = false,
    helium = require('../lib/driver'),
    args = Array.prototype.concat.call(process.argv);


for (var i = 0; i < args.length; ++i) {
    if (args[i] === "-h" || args[i] === "--help") {
        usage();
    } else if (args[i] === "-v" || args[i] === "--version") {
        console.log(require('../package.json').version);
        process.exit(0);
    } else if (args[i] === "-s" || args[i] == "--silence") {
        silence = true;
    }
}


if (args.length < 3) {
    console.error('Please provide URLs!');
    usage();
}


helium.on('info', function(data) {
    if (!silence) console.error(data);
});

helium.on('error', function(err) {
    console.error(err);
    process.exit(1);
});

helium.once('end', function() {
    // TODO:
});


helium(args.slice(2), function(err, output) {
    if (err) {
        console.error(JSON.stringify(err, null, 4) + "\n" + output.substring(0, 100) + output.length > 100 ? '...' : '');
        process.exit(err.code || 1);
    } else {
        // output normally
        console.log(JSON.stringify(output, null, 4));
    }
});



function usage() {
    console.error('Usage: helium-cli [URLs]');
    console.error('\t-s, --silence silence mode');
    console.error('\t-h, --help show help');
    console.error('\t-v, --version show version');
    process.exit(1);
}