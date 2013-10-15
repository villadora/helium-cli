var system = require('system'),
    child_process = require("child_process"),
    async = require('async'),
    cssParser = require('css-parse'),
    timeout = 10000,
    curlScript;


//===========================
// helium portable
//===========================

var helium = {
    start: function(pageList, callback) {
        helium.pageList = pageList;

        callback(null, []);
        helium.getlink(null, pageList, function(err, stylesheets) {
            helium.getcss(err, stylesheets, function(err, rs) {
                helium.checkcss(err, pageList, rs, callback);
            });
        });
    },
    getlink: function(err, pageList, callback) {

    },
    getlink1: function(err, pageList, callback) {
        async.reduce(pageList, [], function(memo, url, cb) {
            var page = require('webpage').create(),
                resources = [];
            page.onConsoleMessage = function(msg, line, source) {
                system.stderr.writeLine('console:' + msg + 'source:' + source + 'line:' + line);
            };
            page.onResourceRequested = function(req) {
                resources[req.id] = req.stage;
            };
            page.onResourceReceived = function(res) {
                resources[res.id] = res.stage;
            };

            // User-Agent is supported through page.settings
            page.settings.userAgent = 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_8_4) AppleWebKit/537.31 (KHTML, like Gecko) Chrome/26.0.1410.65 Safari/537.31';

            // This is how you set other header variables
            page.customHeaders = {
                'Referer': 'localhost'
            };
            system.stderr.writeLine('open ' + url + ' to get stylesheets...');
            page.open(url, function() {
                if (page.injectJs('./helper.js')) {
                    waitFor(function() {
                            for (var i = 1; i < resources.length; ++i) {
                                if (resources[i] != 'end') {
                                    return false;
                                }
                            }
                            return true;
                        },
                        function() {
                            var stylesheets = page.evaluate(function() {
                                return helium.findstylesheets();
                            });

                            cb(null, memo.concat(stylesheets.map(function(ss) {
                                if (typeof ss == "string")
                                    return {
                                        url: url,
                                        stylesheet: ss
                                    };
                                else {
                                    ss.url = url;
                                    return ss;
                                }
                            })));
                        }, timeout);
                } else
                    cb("injectJs() failed.");
            });
        }, function(err, result) {
            callback(err, result);
        });
    },

    //list of stylesheet links on page
    getcss: function(err, stylesheetUrls, callback) {
        if (err) return callback(err, stylesheetUrls);

        async.mapSeries(stylesheetUrls, function(ss, cb) {
                if (ss.body) {
                    var cssdom = cssParser(ss.body),
                        results = [];

                    cssdom.stylesheet.rules.forEach(function(rule) {
                        if (rule.selectors)
                            results.push({
                                selector: rule.selectors.join(','),
                                visible: false
                            });
                    });

                    cb(null, {
                        url: ss.url,
                        stylesheet: ss.url + ss.stylesheet,
                        selectors: results
                    });
                } else {

                    var data = {
                        url: ss.url,
                        stylesheet: ss.stylesheet,
                        selectors: []
                    };


                    var curl,
                        body = '';
                    if (curlScript) {
                        system.stderr.writeLine('try to load ' + ss.stylesheet + ' via ' + curlScript);
                        curl = child_process.spawn("node", [curlScript, ss.stylesheet]);
                    } else {
                        system.stderr.writeLine('try to load ' + ss.stylesheet + ' via curl');
                        curl = child_process.spawn("curl", [ss.stylesheet]);
                    }


                    curl.stdout.on('data', function(chunk) {
                        body += chunk;
                    });

                    curl.on('exit', function(code) {
                        try {
                            if (code !== 0) return cb('curl exited with code:' + code);
                            // in phantomjs, the core node libs are not imported! like http, Buffer
                            // data.size = Buffer.byteLength(body, 'utf8');
                            system.stderr.writeLine('parse css: ' + ss.stylesheet);
                            var cssdom = cssParser(body),
                                results = [];
                            //remove css comments

                            cssdom.stylesheet.rules.forEach(function(rule) {
                                if (rule.selectors)
                                    results.push({
                                        selector: rule.selectors.join(','),
                                        visible: false
                                    });
                            });

                            //store stylesheet results
                            data.selectors = results;
                            cb(null, data);
                        } catch (e) {
                            body = body.replace(/\/\*[\s\S]*?\*\//gim, "").replace(/\n/g, '');
                            // do fallback, css parser ignore errors
                            var selectors = [];
                            cb(null, {
                                url: ss.url,
                                stylesheet: ss.stylesheet,
                                err: e,
                                selectors: selectors
                            });
                        }
                    });
                }
            },
            function(err, results) {
                callback(err, results);
            });
    },

    checkcss: function(err, pageList, stylesheets, callback) {
        if (err) return callback(err);

        async.mapSeries(pageList, function(url, cb) {
            var page = require('webpage').create();
            resources = [];
            page.onConsoleMessage = function(message) {
                system.stderr.writeLine(message);
            };

            page.onResourceRequested = function(req) {
                resources[req.id] = req.stage;
            };
            page.onResourceReceived = function(res) {
                resources[res.id] = res.stage;
            };

            // User-Agent is supported through page.settings
            page.settings.userAgent = 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_8_4) AppleWebKit/537.31 (KHTML, like Gecko) Chrome/26.0.1410.65 Safari/537.31';

            // This is how you set other header variables
            page.customHeaders = {
                'Referer': 'localhost'
            };

            var waitNum = 10;

            page.open(url, function() {
                if (page.injectJs('./helper.js')) {
                    system.stderr.writeLine('analyse selectors in ' + url);
                    waitFor(function() {
                            for (var i = 1; i < resources.length; ++i) {
                                if (resources[i] != 'end') {
                                    return false;
                                }
                            }
                            // wait for 2500 for resource render
                            return !(waitNum--);
                        },
                        function() {
                            var localss = page.evaluate(function(ss, url) {
                                return helium.checkcss(ss, url);
                            }, stylesheets.filter(function(item) {
                                return item.url === url;
                            }), url);

                            // update
                            cb(null, localss);
                        }, timeout);
                } else
                    cb("injectJs() failed.");
            });
        }, function(err, results) {
            if (err) return callback(err);

            var localss = {};

            results.forEach(function(stylesheets) {
                stylesheets.forEach(function(s) {
                    if (!localss.hasOwnProperty(s.stylesheet)) {
                        var d = localss[s.stylesheet] = {
                            stylesheet: s.stylesheet,
                            selectors: {}
                        };

                        if (s.err) d.err = s.err;

                        s.selectors.forEach(function(selector) {
                            if (!d.selectors.hasOwnProperty(selector.selector))
                                d.selectors[selector.selector] = selector;
                            else if (selector.visible !== false) {
                                if (typeof d.selectors[selector.selector].visible !== 'string')
                                    d.selectors[selector.selector].visible = selector.visible;
                            }
                        });
                    } else {
                        var data = localss[s.stylesheet];
                        s.selectors.forEach(function(selector) {
                            if (selector.visible !== false) {
                                var d = data.selectors[selector.selector];
                                if (typeof d.visible !== 'string') {
                                    d.visible = selector.visible;
                                }
                            }
                        });
                    }
                });
            });

            var rs = [];
            for (var s in localss) {
                if (localss.hasOwnProperty(s)) {
                    var stylesheet = {
                        stylesheet: localss[s].stylesheet,
                        selectors: []
                    }, lss = localss[s].selectors;

                    if (localss[s].err)
                        stylesheet.err = localss[s].err;

                    for (var selector in lss) {
                        stylesheet.selectors.push(lss[selector]);
                    }
                    rs.push(stylesheet);
                }
            }

            callback(err, rs);
        });
    }
};



/**
 * Wait until the test condition is true or a timeout occurs. Useful for waiting
 * on a server response or for a ui change (fadeIn, etc.) to occur.
 *
 * @param testFx javascript condition that evaluates to a boolean,
 * it can be passed in as a string (e.g.: "1 == 1" or "$('#bar').is(':visible')" or
 * as a callback function.
 * @param onReady what to do when testFx condition is fulfilled,
 * it can be passed in as a string (e.g.: "1 == 1" or "$('#bar').is(':visible')" or
 * as a callback function.
 * @param timeOutMillis the max amount of time to wait. If not specified, 3 sec is used.
 */

function waitFor(testFx, onReady, timeOutMillis) {
    var maxtimeOutMillis = timeOutMillis ? timeOutMillis : 3000, //< Default Max Timout is 3s
        start = new Date().getTime(),
        condition = false,
        interval = setInterval(function() {
            if ((new Date().getTime() - start < maxtimeOutMillis) && !condition) {
                // If not time-out yet and condition not yet fulfilled
                condition = (typeof(testFx) === "string" ? eval(testFx) : testFx()); //< defensive code
            } else {
                if (!condition) {
                    // If condition still not fulfilled (timeout but condition is 'false')
                    system.stderr.writeLine("'waitFor()' timeout");
                    phantom.exit(1);
                } else {
                    // Condition fulfilled (timeout and/or condition is 'true')
                    // console.info("'waitFor()' finished in " + (new Date().getTime() - start) + "ms.");
                    typeof(onReady) === "string" ? eval(onReady) : onReady(); //< Do what it's supposed to do once the condition is fulfilled
                    clearInterval(interval); //< Stop this interval
                }
            }
        }, 250); // repeat check every 250ms
}


//===========================
//  run phantom
//===========================
var pageList = [];
curlScript = system.args[1];

if (!/\.js$/.test(curlScript)) {
    curlScript = null;
}

// get page url list
for (var i = curlScript ? 2 : 1; i < system.args.length; ++i) {
    var pageUrl = system.args[i];
    if (!/^http/.test(pageUrl)) pageUrl = 'http://' + pageUrl;
    pageList.push(pageUrl);
    system.stderr.writeLine('helium-cli will anlysis ' + pageUrl + '...');
}

if (system.args.length < 2) {
    // no url provided
    system.stderr.writeLine('Please provide url');
    phantom.exit(1);
}


helium.start(pageList, function(err, rs) {
    if (err) {
        system.stderr.writeLine(err);
        phantom.exit(1);
    }

    var output = rs.map(function(ss) {
        var data = {};
        data.name = ss.stylesheet;
        data.unused = [];
        if (ss.err) {
            data.err = ss.err.message;
        }

        var total = 0,
            unused = 0;
        ss.selectors.forEach(function(selector) {
            total++;
            if (selector.visible === false) {
                unused++;
                data.unused.push(selector.selector);
            } else if (typeof selector.visible === 'string') {
                if (!data.hasOwnProperty(selector.visible))
                    data[selector.visible] = [];
                data[selector.visible].push(selector.selector);
            }
        });

        data.unused_perc = (unused / total * 100).toFixed(2);
        return data;
    });

    system.stdout.write(JSON.stringify(output, null, 4));

    phantom.exit();
});