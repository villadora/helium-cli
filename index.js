var childProcess = require('child_process'),
    phantomjs = require('phantomjs'),
    path = require('path'),
    binPath = phantomjs.path;

module.exports = function(urls, callback, debug) {
    if(typeof urls === 'string' ) 
        urls = [urls];
    
    var childArgs = [
        path.join(__dirname, 'helium-script.js'),
        path.join(__dirname, "curl.js")
    ], buffer = '', error = '';


    Array.prototype.push.apply(childArgs, urls);

    if (debug) console.log(binPath, '\n', childArgs);

    var ph = childProcess.spawn(binPath, childArgs);
    
    ph.stdout.setEncoding('utf8');
    ph.stderr.setEncoding('utf8');
    
    ph.stdout.on('data', function(data) {
        buffer += data;
    });

    ph.stderr.on('data', function(data) {
        if (debug) console.log(data);
        error += data;
    });

    ph.on('close', function(code) {
        if(code === 0) {
            var rs;
            try {
                rs = JSON.parse(buffer);
            }catch(e) {
                return callback(e, buffer);
            }
            callback(null, rs);
        }else {
            callback({
                code: code, 
                err: error
            });
        }
    });
};
