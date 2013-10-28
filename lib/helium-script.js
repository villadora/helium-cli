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
        async.waterfall([
            function(cb) {
                helium.getlink(pageList, cb);
            },
            function(pages, cb) {
                var csses = {};

                for (var url in pages) {
                    if (!pages[url].err && pages[url].csses) {
                        var cssAry = pages[url].csses;
                        for (var i = 0, len = cssAry.length; i < cssAry.length; ++i) {
                            var css = cssAry[i];
                            if (!csses.hasOwnProperty(css.url)) {
                                csses[css.url] = {
                                    url: css.url,
                                    name: css.name,
                                    pages: []
                                };

                                // if body is already exists
                                if (css.body) {
                                    csses[css.url].body = css.body;
                                }
                            }

                            csses[css.url].pages.push(url);
                        }
                    }
                }

                cb(null, pages, csses);
            },
            function(pages, csses, cb) {
                var needBody = false;
                for (var cssUrl in csses) {
                    if (!csses[cssUrl].hasOwnProperty('body')) {
                        needBody = true;
                        break;
                    }
                }


                // csses' body are not loaded yet
                if (needBody)
                    helium.getcssbody(csses, function(err, results) {
                        cb(err, pages, results);
                    });
            },
            function(pages, csses, cb) {
                helium.getcssselector(csses, function(err, results) {
                    cb(err, pages, results);
                });
            }
        ], function(err, result) {
            system.stdout.writeLine(JSON.stringify(result, null, 4).substring(0, 10000));
            callback(err, result);
        });
    },
    //list of stylesheet links on page
    getlink: function(pageList, callback) {
        var pages = {};

        async.reduce(pageList, [], function(memo, url, cb) {
            var page = require('webpage').create(),
                resources = [];

            pages[url] = {};
            page.onError = function(msg, trace) {
                system.stderr.writeLine('url:' + url + ' meet error: ' + msg);
                pages[url].err = true;
                pages[url].error = {
                    msg: msg,
                    trace: trace
                };
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
                    // inject helper successfully
                    waitFor(function() {
                            // wait for all the resources are loaded
                            for (var i = 1; i < resources.length; ++i)
                                if (resources[i] != 'end') return false;
                            return true;
                        },
                        function() {
                            var stylesheets = page.evaluate(function() {
                                return helium.findstylesheets();
                            });

                            if (!(stylesheets instanceof Array)) {
                                // inner error
                                pages[url].err = true;
                                return cb();
                            }

                            pages[url].csses = [];
                            // keep all the stylesheet information
                            stylesheets.map(function(ss) {
                                if (typeof ss === "string") {
                                    pages[url].csses.push({
                                        url: ss,
                                        name: ss.substring(ss.lastIndexOf('/') + 1)
                                    });
                                } else {
                                    // for inline stylesheets
                                    ss.url = url + ' ' + ss.name;
                                    pages[url].csses.push(ss);
                                }
                            });

                            cb();
                        }, timeout, function() {
                            // page load timeout
                            pages[url].err = true;
                            pages[url].msg = "Timeout when loading page";
                            cb();
                        });
                } else {
                    pages[url].err = true;
                    pages[url].msg = "Failed to inject helper.js when call InjectJs().";
                    cb();
                }
            });
        }, function(err) {
            callback(err, pages);
        });
    },
    getcssbody: function(csses, callback) {
        var p = [];

        for (var cssUrl in csses) {
            var css = csses[cssUrl];
            p.push(function(cb) {
                if (!css.body) {
                    var curl,
                        body = '';

                    // spawn children 'curl' to get css
                    if (curlScript) {
                        curl = child_process.spawn("node", [curlScript, css.url]);
                    } else {
                        curl = child_process.spawn("curl", [css.url]);
                    }

                    curl.stdout.on('data', function(chunk) {
                        body += chunk;
                    });

                    curl.on('exit', function(code) {
                        if (code !== 0) {
                            css.err = true;
                            css.msg = 'received stylesheet failed';
                            return cb(null, css);
                        } else {
                            css.body = body;
                            return cb(null, css);
                        }
                    });
                } else {
                    cb(null, css);
                }
            });
        }

        async.parallel(p, function(err, results) {
            callback(err, results);
        });
    },
    getcssselector: function(csses, callback) {
        async.mapSeries(csses, function(css, cb) {
                if (!css.err && css.body) {
                    // cssParser some times can not parse invalid csses
                    var cssdom = null;
                    results = [];

                    try {
                        cssdom = cssParser(css.body);
                    } catch (e) {
                        css.err = true;
                        css.msg = 'Parse css body failed';
                        css.error = e;
                        return cb(null, css);
                    }

                    cssdom.stylesheet.rules.forEach(function(rule) {
                        if (rule.selectors && rule.selectors.length)
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

function waitFor(testFx, onReady, timeOutMillis, whenTimeout) {
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
                    if (whenTimeout)
                        whenTimeout();
                    else
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


if ((curlScript && system.args.length < 3) || system.args.length < 2) {
    // no url provided
    system.stderr.writeLine('Please provide url');
    phantom.exit(1);
}


helium.start(pageList, function(err, rs) {
    if (err) {
        // error should go to stderr
        system.stderr.writeLine(err);
        phantom.exit(1);
    }

    system.stdout.write(JSON.stringify(output, null, 4));

    phantom.exit();

    return;

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