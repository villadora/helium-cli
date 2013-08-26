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
        helium.getlink(null, pageList, function(err, stylesheets) {
            helium.getcss(err, stylesheets, function(err, rs) {
                helium.checkcss(err, pageList, rs, callback);
            });
        });
    },


    getlink: function(err, pageList, callback) {
        async.reduce(pageList, [], function(memo, url, cb) {
            var page = require('webpage').create(),
                resources = [];
            page.onConsoleMessage = function(msg, line, source) {
                console.log('console:', msg, 'source:', source, 'line:', line);
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

            console.log('open ', url, ' to get stylesheets...');
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
                    var cssdom = cssParser(body),
                        results = [];
                    cssdom.stylesheet.rules.forEach(function(rule) {
                        results.push(rule.selectors.map(function(s) {
                            return {
                                selector: s,
                                visible: false
                            };
                        }));
                    });

                    cb(null, {
                        url: ss.url,
                        stylesheet: ss.stylesheet,
                        selectors: results
                    });
                    return;
                }

                var data = {
                    url: ss.url,
                    stylesheet: ss.stylesheet,
                    selectors: []
                };


                var curl,
                    body = '';
                if (curlScript) {
                    console.log('try to load ', ss.stylesheet, ' via ', curlScript);
                    curl = child_process.spawn("node", [curlScript, ss.stylesheet]);
                } else {
                    console.log('try to load ', ss.stylesheet, ' via curl');
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
                        console.log('parse css: ', ss.stylesheet);
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
                        cb(e);
                    }
                });
            },

            function(err, results) {
                callback(err, results);
            });
    },

    checkcss: function(err, pageList, stylesheets, callback) {
        async.mapSeries(pageList, function(url, cb) {
                var page = require('webpage').create();
                resources = [];
                page.onConsoleMessage = function(message) {
                    console.log(message);
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


                page.open(url, function() {
                    if (page.injectJs('./helper.js')) {
                        console.log('analyse selectors in ', url);
                        waitFor(function() {
                                for (var i = 1; i < resources.length; ++i) {
                                    if (resources[i] != 'end') {
                                        return false;
                                    }
                                }
                                return true;
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
            },
            function(err, results) {
                var localss = {};

                results.forEach(function(stylesheets) {
                    stylesheets.forEach(function(s) {
                        if (!localss.hasOwnProperty(s.stylesheet)) {
                            var d = localss[s.stylesheet] = {
                                stylesheet: s.stylesheet,
                                selectors: {}
                            };

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
                            stylesheet: localss[s].stylesheet
                        }, lss = localss[s].selectors,
                            selectors = [];

                        for (var selector in lss) {
                            selectors.push(lss[selector]);
                        }

                        stylesheet.selectors = selectors;
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
                    console.error("'waitFor()' timeout");
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

for (var i = curlScript ? 2 : 1; i < system.args.length; ++i) {
    var pageUrl = system.args[i];
    if (!/^http/.test(pageUrl)) pageUrl = 'http://' + pageUrl;
    pageList.push(pageUrl);
}

if (system.args.length < 2) {
    console.error('Please provide url');
    phantom.exit(1);
}


helium.start(pageList, function(err, rs) {
    if (err) {
        console.error(err);
        phantom.exit(1);
    }

    rs.forEach(function(ss) {
        console.log("<" + ss.stylesheet + ">");
        var d = "=====";
        for (var i = 0; i < ss.stylesheet.length; ++i)
            d += "=";
        console.log(d);

        var total = 0,
            unused = 0;
        ss.selectors.forEach(function(selector) {
            total++;
            if (selector.visible === false) {
                unused++;
                console.log('\t' + selector.selector);
            }
        });

        console.log([ss.stylesheet, ':\n\t', (unused / total * 100).toFixed(2), '% is not used'].join(''));
    });

    phantom.exit();
});