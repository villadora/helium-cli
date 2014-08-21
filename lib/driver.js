var childProcess = require('child_process');
var phantomjs = require('phantomjs');
var path = require('path');
var events = require('events');
var phBin = phantomjs.path;


/**
 * @param {Array.<string>} urls
 * @param {object=} options
 * @param {function} callback
 * @api
 */

function helium(urls, options, callback) {
    if (typeof options == 'function' && typeof callback == 'undefined') {
        callback = options;
        options = {};
    }


    if (typeof urls === 'string')
        urls = [urls];

    // build phantomjs arguments
    var childArgs = [];

    if (options.__ && options.__.length) {
        Array.prototype.push.apply(childArgs, options.__);
    }

    childArgs.push(
        path.join(__dirname, 'helium-script.js')
    );

    var scriptConfig = {
        curlScript: path.join(__dirname, "curl.js")
    };

    if (options.userAgent)
        scriptConfig.userAgent = options.userAgent;

    if (options.referer)
        scriptConfig.referer = options.referer;

    childArgs.push(JSON.stringify(scriptConfig));

    var results = '';
    var error = '';


    Array.prototype.push.apply(childArgs, urls);

    var ph = childProcess.spawn(phBin, childArgs);

    ph.stdout.setEncoding('utf8');
    ph.stderr.setEncoding('utf8');

    ph.stdout.on('data', function(data) {
        results += data;
    });

    ph.stderr.on('data', function(data) {
        if (helium.debug)
            process.stderr.write(data);
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

            if (rs) {
                var csses = rs.csses.map(function(css) {
                    var data = {};
                    data.name = css.name;
                    data.url = css.name;

                    if (css.err) {
                        data.err = css.err;
                        data.error = css.error;
                        data.msg = css.msg;
                    } else {
                        data.unused = [];

                        var total = 0,
                            unused = 0,
                            selectors = css.selectors;

                        for (var selector in selectors) {
                            total++;

                            var visible = selectors[selector];
                            if (visible === false) {
                                unused++;
                                data.unused.push(selector);
                            } else if (typeof visible === 'string') {
                                if (!data.hasOwnProperty(visible))
                                    data[visible] = [];
                                data[visible].push(selector);
                            }
                        }
                        data.unused_perc = (unused / total * 100).toFixed(2);
                    }
                    return data;
                });

                callback(null, {
                    csses: csses,
                    pages: rs.pages
                });
            } else {
                callback("can not parse results");
            }
        } else {
            // exist abnormal, means analysis failed
            callback({
                code: code,
                err: error // contain the error information
            }, results);
        }
    });
}

helium.message = new events.EventEmitter();

module.exports = helium;