#!/usr/bin/env node

var childProcess = require('child_process');
var phantomjs = require('phantomjs');
var path = require('path');
var colors = require('colors');
var binPath = phantomjs.path;
var helium = require('../lib/driver');

var argv = require('minimist')(process.argv.slice(2), {
    '--': true
});

var args = argv._;
var __ = argv['--'];

if (argv.h || argv.help) {
    usage();
}

var userAgent = argv.A || argv['user-agent'];
var referer = argv.e || argv.referer;

if (argv.v || argv.version) {
    console.log(require('../package.json').version);
    process.exit(0);
}

if (argv.debug) {
    helium.debug = true;
}

if (!args.length) {
    console.error('Please provide URLs!');
    usage();
}

helium(args, {
    userAgent: userAgent,
    referer: referer,
    __: __
}, function(err, data) {
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
    console.error('Usage: helium-cli [options] [URLs] -- [phantomjs options]');
    console.error('\t-A, --user-agent userAgent will be used when visit URLs');
    console.error('\t-e, --referer Referer will be used when visit URLs');
    console.error('\t-h, --help show help');
    console.error('\t-v, --version show version');
    process.exit(0);
}