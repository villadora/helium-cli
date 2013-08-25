# Helium CLI

A cli tool to discovery unused CSS accros multiple pages based on [phantomjs](http://phantonjs.org), which is migrating from project [helium-css](https://github.com/geuis/helium-css)


## Installation

If you want a standalone cli tool, just run:

    npm install -g helium-cli

If you already has phantomjs installed and also curl in your machine, you can download [helium-script.js](./helium-script.js) and [helper.js](./helper.js).

## Usage

While you install via npm, then you can run:

    helium-cli www.example.com/1 www.example.com/2  

If you already has phantomjs installed and also curl in your machine, you can download [helium-script.js](./helium-script.js) and [helper.js](./helper.js), put them in the same folder and run:

    phantomjs helium-script.js www.example.com/1 www.example.com/2


The output will be:

<pre>
[stylesheet address]
======================
.selector1
selector2
body ul .selector3
... unused csss selectors
</pre>

## TODO

1. Error handling for webpage loading/parsing errors.
2. Detect css selectors used in javascript.

## License

(The BSD License)

Copyright (c) 2013, Villa.Gao <jky239@gmail.com>;
All rights reserved.
