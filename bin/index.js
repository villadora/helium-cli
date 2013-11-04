#!/usr/bin/env node

var childProcess = require('child_process'),
    phantomjs = require('phantomjs'),
    path = require('path'),
    colors = require('colors'),
    binPath = phantomjs.path,
    helium = require('../lib/driver'),
    args = Array.prototype.concat.call(process.argv);

for (var i = 0; i < args.length; ++i) {
    if (args[i] === "-h" || args[i] === "--help") {
        usage();
    } else if (args[i] === "-v" || args[i] === "--version") {
        console.log(require('../package.json').version);
        process.exit(0);
    } else if (args[i] === '--debug') {
        helium.debug = true;
        args.splice(i, 1);
    }
}


if (args.length < 3) {
    console.error('Please provide URLs!');
    usage();
}


helium(args.slice(2), function(err, data) {
    if (err) {
        console.error(JSON.stringify(err, null, 4) + "\n" + data.substring(0, 100) + data.length > 100 ? '...' : '');
        process.exit(err.code || 1);
    } else {
        // TODO: data info
        var pages = data.pages,
            csses = data.csses;

        for (var url in pages) {
            var page = pages[url];
            if (page.err) {
                console.log(("PAGE (" + url + ") ERROR").red);
                console.log(("\tERROR MSG:" + page.msg).red);
            }
        }

        csses.forEach(function(css) {
            if (css.err) {
                console.log(("CSS (" + css.url + ") ERROR").red);
                console.log(("\tERROR MSG:" + css.msg).red);
            } else {
                console.log(("CSS (" + css.url + ") RESULT").green);
                console.log(("\t" + css.unused.length + ' rules (' + css.unused_perc + "%) of CSS not used.").green);
            }
        });
    }
});



function usage() {
    console.error('Usage: helium-cli [URLs]');
    console.error('\t-h, --help show help');
    console.error('\t-v, --version show version');
    process.exit(1);
}