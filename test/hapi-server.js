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

function startServer(callback, autoStart, port) {

	var manifest = {
		pack : {},
		servers : [ {
			port : port || 8000,
			options : {
				labels : [ 'web' ]
			}
		} ],
		plugins : {
			'lout' : {},
			'furball' : {},
			'runrightfast-logging-service-hapi-plugin' : {}
		}
	};

	var options = {
		manifest : manifest,
		callback : callback,
		autoStart : !!autoStart,
		logLevel : 'DEBUG'
	};

	var HapiServer = require('../index');
	var hapiServer = new HapiServer(options);
	if (!options.autoStart) {
		hapiServer.start(callback);
	}
	return hapiServer;
}

var loggingClient = require('runrightfast-logging-client')({
	url : 'http://localhost:8000/log'
});

describe('Hapi Server', function() {
	var server = undefined;

	before(function(done) {
		server = startServer(done);
	});

	after(function() {
		server.stop(function() {
			console.log('*** after Hapi Server - server has stopped');
		});
	});

	it('log a valid event', function() {
		var event = {
			tags : [ 'info' ],
			data : 'test : log a valid event'
		};

		loggingClient.log(event);
	});

	it('starting the server, when it is already started causes no harm', function(done) {
		server.start(function() {
			console.log('Server should already be started');

			var event = {
				tags : [ 'info' ],
				data : 'test : starting the server, when it is already started causes no harm'
			};

			loggingClient.log(event);
			done();
		});

	});

	it('can be restarted', function(done) {
		var event = {
			tags : [ 'info' ],
			data : 'test : can be restarted'
		};

		server.stop(function() {
			server.start(function() {
				loggingClient.log(event);
				console.log('logged event after restarting server : loggingClient.eventCount = ' + loggingClient.eventCount);
				done();
			});
		});
	});

	it('if already stopped, then stopping again cause no harm', function(done) {
		var server2 = startServer(undefined, true, 8002);

		server2.stop(function() {
			server2.stop(done);
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
			url : 'http://localhost:8003/log'
		});

		var event = {
			tags : [ 'info' ],
			data : 'test : can be specified via a function'
		};

		hapiServer.start(function() {
			console.log('hapiServer.status = ' + hapiServer.status);
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