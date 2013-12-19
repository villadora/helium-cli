# Helium CLI

A command-line tool to discovery unused CSS accros multiple pages based on [phantomjs](http://phantonjs.org), which is inspired by project [helium-css](https://github.com/geuis/helium-css).

## Installation

If you want a standalone cli tool, just run(highly suggest):

    npm install -g helium-cli

If you already has phantomjs installed and also curl in your machine, and you really don't want to download phantomjs again due to some reason.
Then you can clone this repository and remove the "phantomjs" "request" dependencies in the [package.json](./package.json).


## Usage

### Use in command-line

While you install via npm, then you can run:

    helium-cli www.example.com/1 www.example.com/2  

If you already has [phantomjs](http://phantomjs.org) installed and also [curl](http://curl.haxx.se/) in your machine and clone the repository into your local disk.
You can just run: 

    phantomjs helium-script.js www.example.com/1 www.example.com/2

```javascript

```


### Use in node

Now you can use `helium-cli` pragmatically in node: 

```javascript
   var helium = require('helium-cli');
   
   helium('www.example.com', function(err, data) {
        // analyse results
        // data is looks like following : 
        {
          pages: {
            "www.example.com" : {
              err: true, 
              error: new Error('...'),
              msg: 'xxx...'
            }, 
            "www.example1.com": {
              "csses": [{
                "url":"http://www.example1.com/one.css",
                "name": "one.css"
              },
              {
                "url": "http://www.example1.com/ <anonymouse inner-style:0>",
                "name": "<anonymouse inner-style>",
                "body": "...."
              }]
            }
          },
          csses: [{
            "name": "xxx",
            "url": "xxx..",
            "unused": [
                'unused selectors'...
            ],
            "pseudo_class": [
                'pseudo classes'...
            ],
            "invalid_selector": [
                'invalid selectors'...
            ],
            "unused_perc": "54.3" // percentage of unused selectors
            }, {
              "name": "xxx2",
              "url": "xxxx...",
              "err": true,
              "error": new Error('...'),
              "msg": "xxxx..."
          }]
       }
   });
   
   helium(['www.example.com', 'www.example1.com'], function(err, data) {
        // analyse results
        ...
   });
   
```



## TODO

1. ~~Error handling for webpage loading/parsing errors.~~
2. Detect css selectors used in javascript.
3. ~~Psuedo class detect.~~


## License

(The MIT License)

Copyright (c) 2013, Villa.Gao <jky239@gmail.com>;
All rights reserved.
