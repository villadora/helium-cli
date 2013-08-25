var request = require('request'),
    url = process.argv[process.argv.length - 1];

request(url, function(err, res, body) {
    if (err || res.statusCode !== 200) return console.error('curl ' + url + ' failed!');
    console.log(body);
});