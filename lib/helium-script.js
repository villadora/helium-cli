var system = require('system'),
    child_process = require("child_process"),
    async = require('async'),
    cssParser = require('css-parse'),
    timeout = 10000,
    userAgent,
    referer,
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

                cb(null, csses, pages);
            },
            function(csses, pages, cb) {
                var needBody = false;
                for (var cssUrl in csses) {
                    if (!csses[cssUrl].hasOwnProperty('body')) {
                        needBody = true;
                        break;
                    }
                }

                // csses' body are not loaded yet
                if (needBody) {
                    helium.getcssbody(csses, function(err, results) {
                        cb(err, results, pages);
                    });
                } else {
                    cb(null, csses, pages);
                }
            },
            function(csses, pages, cb) {
                helium.getcssselector(csses, function(err, results) {
                    cb(err, results, pages);
                });
            },
            function(csses, pages, cb) {
                helium.checkcss(csses, pages, function(err, results) {
                    cb(null, results, pages);
                });
            }
        ], function(err, result, pages) {
            var csses = {};
            for (var url in result) {
                (function(ary) {
                    ary.forEach(function(css) {
                        if (!csses.hasOwnProperty(css.url)) {
                            csses[css.url] = [];
                        }
                        var copy = {};
                        copy.name = css.name;
                        copy.url = css.url;
                        if (css.err) {
                            copy.err = css.err;
                            copy.msg = css.msg;
                            copy.error = css.error;
                        }

                        if (css.selectors)
                            copy.selectors = css.selectors;
                        csses[css.url].push(copy);
                    });
                })(result[url]);
            }

            var rs = [];
            for (var cssUrl in csses) {
                rs.push(helium.mergecss(csses[cssUrl]));
            }

            callback(err, {
                csses: rs,
                pages: pages
            });
        });
    },
    mergecss: function(ary) {
        var css = {};
        for (var i = 0, len = ary.length; i < len; ++i) {
            if (i === 0) {
                css.name = ary[i].name;
                css.url = ary[i].url;
                css.selectors = {};
            }

            if (!ary[i].err) {
                // if (!ary[i].selectors)
                //     system.stderr.writeLine(JSON.stringify(ary[i], null, 4));
                // else
                ary[i].selectors.forEach(function(selector) {
                    if (!css.selectors.hasOwnProperty(selector.selector))
                        css.selectors[selector.selector] = selector.visible;
                    else {
                        if (css.selectors[selector.selector] !== true) {
                            if (typeof css.selectors[selector.selector] != "string") {
                                css.selectors[selector.selector] = selector.visible;
                            }
                        } else {
                            css.selectors[selector.selector] = true;
                        }
                    }
                });
            } else {
                css.err = ary[i].err;
                css.msg = ary[i].msg;
                css.error = ary[i].error;
            }
        }

        return css;
    },
    // list of stylesheet links on page
    getlink: function(pageList, callback) {
        var pages = {};

        async.reduce(pageList, [], function(memo, url, cb) {
            var page = require('webpage').create(),
                resources = [];
            pages[url] = {};


            page.onError = function(msg, trace) {
                pages[pageUrl].err = true;
                pages[pageUrl].error = {
                    msg: msg,
                    trace: trace
                };
            };

            openPage(page, url, function() {
                if (page.injectJs('./helper.js')) {
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
    // get body for css from stylesheet url
    getcssbody: function(csses, callback) {
        var p = {};

        for (var curl in csses) {
            (function(cssUrl) {
                var css = csses[cssUrl];
                p[cssUrl] = function(cb) {
                    if (!css.body) {
                        system.stderr.writeLine('getcssbody for ' + cssUrl + '...');
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
                };
            })(curl);
        }

        async.parallel(p, function(err, results) {
            callback(err, results);
        });
    },
    // analyze selectors
    getcssselector: function(csses, callback) {
        var p = {};

        for (var curl in csses) {
            (function(cssUrl) {
                var css = csses[cssUrl];
                p[cssUrl] = function(cb) {
                    system.stderr.writeLine('getcssselector for ' + cssUrl + '...');
                    if (!css.err && css.body) {
                        // cssParser some times can not parse invalid csses
                        var cssdom = null;
                        results = [];

                        try {
                            cssdom = cssParser(css.body);
                        } catch (e) {
                            css.err = true;
                            css.msg = 'Parse css body failed: ' + e.message;
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

                        css.selectors = results;

                        // delete body
                        delete css.body;

                        cb(null, css);
                    } else {
                        cb(null, css);
                    }
                };
            })(curl);
        }

        async.series(p, function(err, results) {
            callback(err, results);
        });
    },
    // check css selectors
    checkcss: function(csses, pagesResults, callback) {
        var pageUrls = {};

        for (var cssUrl in csses) {
            (function(cssUrl) {
                system.stderr.writeLine('checkcss for ' + cssUrl + '...');
                var css = csses[cssUrl];
                css.pages.forEach(function(url) {
                    if (!pageUrls.hasOwnProperty(url))
                        pageUrls[url] = [];

                    pageUrls[url].push(css);
                });
            })(cssUrl);
        }


        var tasks = {};

        for (var pageUrl in pageUrls) {
            (function(pageUrl) {
                tasks[pageUrl] = function(cb) {
                    var page = require('webpage').create();
                    page.onError = function(msg, trace) {
                        pagesResults[pageUrl].err = true;
                        pagesResults[pageUrl].error = {
                            msg: msg,
                            trace: trace
                        };
                    };

                    openPage(page, pageUrl, function() {
                        if (page.injectJs('./helper.js')) {
                            var stylesheets = page.evaluate(function(stylesheets) {
                                return helium.checkcss(stylesheets);
                            }, pageUrls[pageUrl]);

                            cb(null, stylesheets);
                        } else {
                            pagesResults[pageUrls].err = true;
                            pagesResults[pageUrls].error = {
                                msg: "Failed to inject helper.js"
                            };
                            cb(null, pageUrls[pageUrl]);
                        }
                    });
                };
            })(pageUrl);
        }

        async.series(tasks, function(err, results) {
            callback(err, results);
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


function openPage(page, url, after) {
    var resources = {};

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
    page.settings.userAgent = userAgent || 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_8_4) AppleWebKit/537.31 (KHTML, like Gecko) Chrome/26.0.1410.65 Safari/537.31';

    // This is how you set other header variables
    page.customHeaders = {
        'Referer': referer || 'localhost'
    };

    var waitNum = 10;

    page.open(url, function() {
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
                after();
            }, timeout);
    });
}


//===========================
//  run phantom
//===========================
var pageList = [];
var scriptConfig = {};
system.stderr.writeLine('Config options:' + system.args[1]);

try {
    scriptConfig = JSON.parse(system.args[1]);
} catch (e) {
    system.out.stderr(String(e));
    phantom.exit(1);
}


curlScript = scriptConfig.curlScript;
userAgent = scriptConfig.userAgent;
referer = scriptConfig.referer;

system.stderr.writeLine(userAgent + '  ' + referer);

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


    system.stdout.writeLine(JSON.stringify(rs, null, 4));

    phantom.exit();

});