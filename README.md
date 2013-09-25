# RunRightFast Hapi Server
Makes it easy to startup a Hapi server leveraging [Hapi's Composer](http://spumko.github.io/resource/api/#hapi-composer) feature.
The only required option setting is the Hapi manifest

```
(function() {
	'use strict';

	var HapiServer = require('runrightfast-hapi-server');
	var manifest = require('./manifest');

	var options = {
		manifest : manifest
	};

	new HapiServer(options);

}());
```

## Features
* HapiServer is an EventEmitter, which emits the following events:  STARTED, STOPPED
* If _SIGTERM_ or _SIGINT_ signal is received, then Hapi Server will be shutdown cleanly before the process exits
 * If the process is exited for any other reason, then on process exit the Hapi Server will first be shutdown
* The Hapi Server runs within its own [Domain](http://nodejs.org/api/domain.html#domain_domain)
  * if an uncaught exception bubbles to the top, then on the Domain 'error' event, 
    the Hapi server will be stopped before the process is exited. By the very nature of how throw works in JavaScript, 
    there is almost never any way to safely "pick up where you left off", without leaking references, 
    or creating some other sort of undefined brittle state.

## Configuration Options

* manifest - REQUIRED - can be one of the following types:
  * Object - a manifest object as described in Hapi's documentation
  * Function - that returns a manifest object
  * String - which represents a CommonsJS module that exports a manifest object
* autoStart - OPTIONAL - default is true
* stopTimeout - OPTIONAL 
  * the timeout in millisecond before forcefully terminating a connection. Defaults to 10000 (10 seconds)
* name - OPTIONAL - server name, which is also used as the logger name. Defaults to 'runrightfast-hapi-server'
* logLevel - OPTIONAL - specifies the level of logging by the Hapi Server. Defaults to 'WARN'
* startCallback - OPTIONAL - used to specify a callback function, which is invoked when the server is started
* stopCallback - OPTIONAL - used to specify a callback function, which is invoked when the server is stopped

## HapiServer Interface - see the [code](https://github.com/runrightfast/runrightfast-hapi-server/blob/master/lib/hapi-server.js) 






