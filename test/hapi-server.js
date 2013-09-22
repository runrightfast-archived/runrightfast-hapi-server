'use strict';
var expect = require('chai').expect;

function startServer(callback) {

	var manifest = {
		pack : {},
		servers : [ {
			port : 8000,
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
		autoStart : false
	};

	var HapiServer = require('../index');
	var hapiServer = new HapiServer(options);
	hapiServer.start(callback);
	return hapiServer;
}

describe('LoggingClient', function() {
	var server = null;

	before(function(done) {
		server = startServer(done);
	});

	after(function() {
		console.log('after() ... ');
		server.stop();
		console.log('after() - DONE ');
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
});