var childProcess = require('child_process'),
    phantomjs = require('phantomjs'),
    path = require('path'),
    event = require('event'),
    phBin = phantomjs.path;

var helium = function(urls, cb, debug) {
    if (typeof urls === 'string')
        urls = [urls];


    // build phantomjs arguments
    var childArgs = [
        path.join(__dirname, 'helium-script.js'),
        path.join(__dirname, "curl.js")
    ],
        buffer = '',
        error = '';

    Array.prototype.push.apply(childArgs, urls);

    // only output info when debug is enabled
    if (debug) helium.emit('debug', 'run command: ' + phBin + ' ' + childArgs.join(' '));

    var ph = childProcess.spawn(phBin, childArgs);

    ph.stdout.setEncoding('utf8');
    ph.stderr.setEncoding('utf8');

    ph.stdout.on('data', function(data) {
        buffer += data;
    });

    ph.stderr.on('data', function(data) {
        // error should be forward
        if (debug) helium.emit('debug', data);
        // collecting debug/error information
        error += data;
    });

    ph.on('close', function(code) {
        if (code === 0) { // running successfully
            var rs;
            try {
                rs = JSON.parse(buffer);
            } catch (e) {
                return callback(e, buffer);
            }

            callback(null, rs);
        } else {
            // exist abnormal, means analysis failed
            callback({
                code: code,
                err: error // contain the error information
            }, buffer);
        }
    });
};


helium.prototype.__proto__ = event.EventEmitter.prototype;