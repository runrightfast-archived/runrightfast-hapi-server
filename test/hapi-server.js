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
		autoStart : !!autoStart
	};

	var HapiServer = require('../index');
	var hapiServer = new HapiServer(options);
	if (!options.autoStart) {
		hapiServer.start(callback);
	}
	return hapiServer;
}

describe('Hapi Server', function() {
	var server = null;

	before(function(done) {
		server = startServer(done);
	});

	after(function() {
		server.stop(function() {
			console.log('server has stopped');
		});
	});

	it('log a valid event', function() {
		var loggingClient = require('runrightfast-logging-client')({
			url : 'http://localhost:8000/log'
		});

		var event = {
			tags : [ 'info' ],
			data : 'test : log a valid event'
		};

		loggingClient.log(event);
		expect(loggingClient.eventCount).to.equal(1);
		expect(loggingClient.invalidEventCount).to.equal(0);
	});

	describe('can auto-start', function() {
		before(function() {
			server = startServer(undefined, true, 8001);
		});

		after(function() {
			setImmediate(function() {
				server.stop(function() {
					console.log('server has stopped');

					server.stop(function() {
						console.log('server should already be stopped');
					});
				});
			});
		});

		it('log a valid event', function() {
			var loggingClient = require('runrightfast-logging-client')({
				url : 'http://localhost:8001/log'
			});

			var event = {
				tags : [ 'info' ],
				data : 'test : log a valid event'
			};

			loggingClient.log(event);
			expect(loggingClient.eventCount).to.equal(1);
			expect(loggingClient.invalidEventCount).to.equal(0);
		});

		it('starting the server, when it is already started causes no harm', function() {
			server.start(function() {
				console.log('Server should already be started');
			});
			var loggingClient = require('runrightfast-logging-client')({
				url : 'http://localhost:8001/log'
			});

			var event = {
				tags : [ 'info' ],
				data : 'test : starting the server, when it is already started causes no harm'
			};

			loggingClient.log(event);
			expect(loggingClient.eventCount).to.equal(1);
			expect(loggingClient.invalidEventCount).to.equal(0);
		});

		it('can be restarted', function(done) {
			var loggingClient = require('runrightfast-logging-client')({
				url : 'http://localhost:8001/log'
			});

			var event = {
				tags : [ 'info' ],
				data : 'test : can be restarted'
			};

			server.stop(function() {
				server.start(function() {
					loggingClient.log(event);
					console.log('logged event after restarting server : loggingClient.eventCount = ' + loggingClient.eventCount);
					expect(loggingClient.eventCount).to.equal(1);
					expect(loggingClient.invalidEventCount).to.equal(0);
					done();
				});
			});
		});

	});

	describe('can be stopped', function() {

		it('if already stopped, then stopping again cause no harm', function(done) {
			server = startServer(undefined, true, 8002);

			setImmediate(function() {
				server.stop(function() {
					console.log('server is stopped');

					server.stop(function() {
						console.log('called stop again');
						done();
					});
				});
			});

		});

	});

	describe('manifest can be specified in multiple ways', function() {

		it('can be specified via a function', function(done) {
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

			hapiServer.start(function() {
				hapiServer.stop();
				done();
			});

		});

		it('can be specified via a manifest supplied by a module', function(done) {
			var options = {
				manifest : '../test/manifest',
				autoStart : false
			};

			var HapiServer = require('../index');
			var hapiServer = new HapiServer(options);

			hapiServer.start(function() {
				hapiServer.stop();
				done();
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
});