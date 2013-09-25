/**
 * Copyright [2013] [runrightfast.co]
 * 
 * Licensed under the Apache License, Version 2.0 (the "License"); you may not
 * use this file except in compliance with the License. You may obtain a copy of
 * the License at
 * 
 * http://www.apache.org/licenses/LICENSE-2.0
 * 
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS, WITHOUT
 * WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied. See the
 * License for the specific language governing permissions and limitations under
 * the License.
 */

'use strict';
var expect = require('chai').expect;
var lodash = require('lodash');

var logging = require('runrightfast-commons').logging;
var log = logging.getLogger('runrighfast-hapi-server-test');

var startServerCount = 0;

function startServer(callback, autoStart, port) {
	startServerCount++;

	log.info('****** startServer() args : ' + JSON.stringify({
		callback : callback,
		autoStart : autoStart,
		port : port
	}));

	var manifest = {
		pack : {},
		servers : [ {
			port : port,
			options : {
				labels : [ 'api' ]
			}
		}, {
			port : port + 1,
			options : {
				labels : [ 'api' ]
			}
		} ],
		plugins : {
			'lout' : {},
			'furball' : {},
			'runrightfast-logging-service-hapi-plugin' : {
				logRoutePath : '/api/runrightfast-logging-service/log',
				async : false,
				logLevel : 'DEBUG'
			}
		}
	};

	var options = {
		manifest : manifest,
		callback : callback,
		autoStart : !!autoStart,
		logLevel : 'ERROR',
		startCallback : function(error) {
			log.info('*** ' + startServerCount + '[' + port + '] : startServer(): server started' + (error ? ' - ' + error : ''));
		},
		stopCallback : function() {
			log.info('*** ' + startServerCount + '[' + port + ']  : startServer(): server stopped.');
		}
	};

	var HapiServer = require('../index');
	var hapiServer = new HapiServer(options);
	if (!options.autoStart) {
		hapiServer.start(callback);
	}
	return hapiServer;
}

describe('Hapi Server', function() {
	var server = undefined;
	var loggingClient = require('runrightfast-logging-client')({
		url : 'http://localhost:8001/api/runrightfast-logging-service/log'
	});

	beforeEach(function(done) {
		server = startServer(done, false, 8001);
	});

	afterEach(function(done) {
		setImmediate(function() {
			server.stop(function() {
				done();
			});
		});
	});

	it('log a valid event', function() {
		var event = {
			tags : [ 'info' ],
			data : 'test : log a valid event'
		};
		loggingClient.log(event);
		expect(loggingClient.invalidEventCount).to.equal(0);
		expect(loggingClient.eventCount).to.equal(1);
	});

	it('starting the server, when it is already started causes no harm', function(done) {
		server.start(function() {
			log.info('Server should already be started');

			var event = {
				tags : [ 'info' ],
				data : 'test : starting the server, when it is already started causes no harm'
			};

			loggingClient.log(event);
			done();
		});

	});

	it('restarting throws an error because it is not permitted', function(done) {
		server.stop(function() {
			try {
				server.start(function(error) {
					if (!error) {
						done(new Error('restarting throws an error because it is not permitted'));
					}
				});
				done(new Error('restarting throws an error because it is not permitted'));
			} catch (error) {
				done();
			}
		});

	});

	it('if already stopped, then stopping again cause no harm', function(done) {
		server.stop(function() {
			server.stop(done);
		});

	});

	it('manifest can be specified via a function', function(done) {
		var manifest = function() {
			return {
				pack : {},
				servers : [ {
					port : 8003,
					options : {
						labels : [ 'api' ]
					}
				} ],
				plugins : {
					'lout' : {},
					'furball' : {}
				}
			};
		};

		var options = {
			manifest : manifest,
			autoStart : false
		};

		var HapiServer = require('../index');
		var hapiServer = new HapiServer(options);

		var loggingClient = require('runrightfast-logging-client')({
			url : 'http://localhost:8003/api/runrightfast-logging-service/log'
		});

		var event = {
			tags : [ 'info' ],
			data : 'test : can be specified via a function'
		};

		hapiServer.start(function() {
			log.info('hapiServer.status = ' + hapiServer.status);
			expect(hapiServer.status).to.equal('STARTED');
			loggingClient.log(event);
			hapiServer.stop(done);
		});

	});

	it('manifest can be specified via a manifest supplied by a module', function(done) {
		var options = {
			manifest : '../test/manifest',
			autoStart : false
		};

		var HapiServer = require('../index');
		var hapiServer = new HapiServer(options);

		hapiServer.start(function() {
			hapiServer.stop(done);

		});

	});

	it('will not startup if the manifest is not a valid type', function(done) {
		var options = {
			manifest : 123,
			autoStart : false
		};

		var HapiServer = require('../index');
		try {
			new HapiServer(options);
			done(new Error('expected an Error because manifest is not a valid type'));
		} catch (error) {
			// expected
			done();
		}

	});

	it('will not startup if the manifest is not a valid', function(done) {
		var options = {
			manifest : {},
			autoStart : false
		};

		var HapiServer = require('../index');
		var server = new HapiServer(options);
		server.start(function(err) {
			if (err) {
				console.error('server failed to startup as expected : ' + err.message);
				done();
			} else {
				done(new Error('expected an Error because manifest is not valid'));
			}
		});

	});

	it('will not startup if the manifest is not a valid because plugin cannot be found', function(done) {
		var options = {
			manifest : {
				pack : {},
				servers : [ {
					port : 8094,
					options : {
						labels : [ 'api' ]
					}
				} ],
				plugins : {
					'DOES_NOT_EXIST' : {}
				}
			},
			autoStart : false
		};

		var HapiServer = require('../index');
		var server = new HapiServer(options);
		server.start(function(err) {
			if (err) {
				console.error('server failed to startup as expected : ' + err.message);
				done();
			} else {
				done(new Error('expected an Error because manifest is not valid'));
			}
		});

	});
});