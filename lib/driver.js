var childProcess = require('child_process'),
    phantomjs = require('phantomjs'),
    path = require('path'),
    events = require('events'),
    phBin = phantomjs.path;


/**
 * @param {Array.<string>} urls
 * @param {function} callback
 * @api
 */

function helium(urls, callback) {
    if (typeof urls === 'string')
        urls = [urls];


    // build phantomjs arguments
    var childArgs = [
        path.join(__dirname, 'helium-script.js'),
        path.join(__dirname, "curl.js")
    ],
        results = '',
        error = '';

    Array.prototype.push.apply(childArgs, urls);

    // only output info when debug is enabled
    helium.emit('info', 'run command: ' + phBin + ' ' + childArgs.join(' '));

    var ph = childProcess.spawn(phBin, childArgs);

    ph.stdout.setEncoding('utf8');
    ph.stderr.setEncoding('utf8');

    ph.stdout.on('data', function(data) {
        results += data;
    });

    ph.stderr.on('data', function(data) {
        console.error(data);
        // collecting debug/error information
        error += data;
    });

    ph.on('close', function(code) {
        if (code === 0) { // running successfully
            var rs;
            try {
                rs = JSON.parse(results);
            } catch (e) {
                return callback(e, results);
            }

            callback(null, rs);
        } else {
            // exist abnormal, means analysis failed
            callback({
                code: code,
                err: error // contain the error information
            }, results);
        }
    });
}


helium.__proto__ = new events.EventEmitter();

module.exports = helium;