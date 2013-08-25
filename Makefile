test: jshint
	@./node_modules/.bin/mocha -R spec

jshint:
	@./node_modules/.bin/jshint *.js

.PHONY: jshint test
