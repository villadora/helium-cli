var helium = {
    timeout: 3000,
    findstylesheets: function() {
        try {
            var stylesheets = [],
                //find link elements on the page
                links = document.getElementsByTagName("link"),
                directory;

            for (var i = 0; i < links.length; i++) {
                var refAttr = links[i].getAttribute('rel');
                if (refAttr != "stylesheet") continue;
                //get href
                var tmplink = links[i].getAttribute('href');

                //append full URI if absent
                if (tmplink.indexOf('http') !== 0 && tmplink.substr(0, 2) !== '//') {
                    // make sure that relative URLs work too
                    if (tmplink.indexOf('/') !== 0) {
                        var lastDir = window.location.pathname.lastIndexOf('/');
                        if (lastDir > 0) {
                            directory = window.location.pathname.substring(0, lastDir + 1);
                        } else {
                            directory = '/';
                        }
                        tmplink = directory + tmplink;
                    }
                    tmplink = window.location.protocol + '//' + window.location.hostname + ":" + window.location.port + tmplink;
                }

                //filter out urls not on this domain
                stylesheets.push(tmplink);
            }


            //remove duplicates from stylesheets list
            stylesheets.sort();

            for (var i = 0; i < stylesheets.length - 1; i++) {
                if (stylesheets[i] === stylesheets[i + 1]) {
                    stylesheets.splice(i--, 1);
                }
            }

            var styles = document.getElementsByTagName('style');
            for (var i = 0; i < styles.length; ++i) {
                stylesheets.push({
                    name: '<anonymouse inner-style:' + i + '>',
                    body: styles[i].innerText
                });
            }

            return stylesheets;
        } catch (e) {
            throw e;
        }
    },
    //check if selectors found on pages
    checkcss: function(stylesheets) {
        for (var i = 0; i < stylesheets.length; i++) {
            var stylesheet = stylesheets[i];

            if (!stylesheet.err) {
                //loop through selectors and test if active on this page. 
                for (var j = 0; j < stylesheet.selectors.length; j++) {
                    var selector = stylesheet.selectors[j];
                    if (selector.visible !== true) {
                        var response = helium.check(selector.selector);
                        if (response === true) {
                            selector.visible = true;
                        }

                        if (response === 'invalid_selector') {
                            selector.visible = 'invalid_selector';
                        }
                        if (response === 'pseudo_class') {
                            selector.visible = 'pseudo_class';
                        }
                    }
                }
            }
        }
        return stylesheets;
    },

    //search current page for selectors
    check: function(selector) {
        //try/catch is used because querySelectorAll throws errors when syntactically invalid selectors are passed through. Useful for detection purposes.
        try {
            //returns true if selector found on page, false if not
            if (helium.$(selector).length > 0) {
                return true;
            }
        } catch (err) {
            return 'invalid_selector';
        }

        //detect if the selector includes a pseudo-class, i.e. :active, :focus
        var parse = selector.match(/\:+[\w-]+/gi);
        if (parse !== null && parse.hasOwnProperty('length') && parse.length > 0) {
            var trueSelector = selector.replace(/\:[\w-]+/gi, '');
            var reccheck = helium.check(trueSelector);
            if (reccheck === false) return false;
            return 'pseudo_class';
        } else {
            return false;
        }
    },
    trim: function(str) {

        if (typeof String.prototype.trim === 'function') {
            return str.trim();
        } else {
            return str.replace(/^\s+/, '').replace(/\s+$/, '');
        }

    },

    $: function(selector) {
        return document.querySelectorAll(selector);
    }

};