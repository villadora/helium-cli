# ChangeLog

## Changes in 1.1.0

* Add new options to specified `UserAgent` and `Referer`

```bash
helium-cli --user-agent 'Mobile' --referer 'www.example.com' http://www.example.com/home
```

* Allow pass arguments to phantomjs process, just pass the arguments after `--`

```bash
helium-cli http://www.example.com/home -- --disk-cache=true --web-security=true
```

* Adding options object in api calls


## Changes in 1.0.0

* Analyze csses crossing pages
* Support using api in node programmatically
* Output error when processing fails
* First release
