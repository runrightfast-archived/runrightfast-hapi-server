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

/**
 * exports a HapiServer object, which is also an EventEmitter that emits the
 * following events:
 * 
 * <code>
 * STARTED
 * STOPPED 
 * </code>
 * 
 * <code>
 * options : {
 * 	manifest : manifest, // REQUIRED - A Hapi manifest that will be used to compose the Hapi server (http://spumko.github.io/resource/api/#hapi-composer)
 *  					// can be one of the following values:
 *  					// 1. String, which represents the module to load, which exports the manifest
 *  					// 2. manifest object
 *  					// 3. function that returns a manifest object
 *  autoStart: true, // OPTIONAL - the default is true, which will startup the server automatically,
 *  stopTimeout : 60 * 1000, // OPTIONAL - the timeout in millisecond before forcefully terminating a connection. Defaults to 60000 (60 seconds). 
 *  name: 'runrightfast-hapi-server', // OPTIONAL - server name, which is also used as the logger name. Defaults to 'runrightfast-hapi-server'.
 *  logLevel: 'WARN' // OPTIONAL - specifies the level of logging by the Hapi Server. Defaults to 'WARN''
 * </code>
 */
(function() {
	'use strict';

	var Hapi = require('hapi');
	var logging = require('runrightfast-commons').logging;
	var log = logging.getLogger('runrighfast-hapi-server');
	var events = require('runrightfast-commons').events;
	var lodash = require('lodash');
	var util = require('util');
	var Hoek = require('hoek');
	var assert = Hoek.assert;
	var extend = require('extend');

	var domain = require('domain');

	var STOPPED = 'STOPPED', STARTED = 'STARTED';

	var HapiServer = function HapiServer(options) {
		events.AsyncEventEmitter.call(this);
		var self = this;

		assert(!lodash.isUndefined(options), 'options are required');
		assert(!lodash.isUndefined(options.manifest), 'options.manifest is required');

		var defaultOptions = {
			autoStart : true,
			stopTimeout : 60 * 1000,
			name : 'runrightfast-hapi-server',
			logLevel : 'WARN'
		};
		options = extend(defaultOptions, options);
		logging.setLogLevel(log, options.logLevel);
		log.debug(options);

		assert(lodash.isString(options.name), 'options.name must be a String');
		assert(lodash.isBoolean(options.autoStart), 'options.autoStart must be a boolean');
		assert(lodash.isNumber(options.stopTimeout) && options.stopTimeout >= 0, 'options.stopTimeout must be a Number >= 0');

		var getManifest = function getManifest() {
			if (lodash.isFunction(options.manifest)) {
				log.debug('options.manifest is a function');
				return options.manifest();
			}

			if (lodash.isString(options.manifest)) {
				log.debug('options.manifest is a String, which should reference a module to load');
				return require(options.manifest);
			}

			if (lodash.isObject(options.manifest)) {
				log.debug('options.manifest is an Object');
				return options.manifest;
			}

			throw new Error('options.manifest must be either an Object, String, or Function - but its type is : ' + (typeof options.manifest));
		};

		this.serverDomain = undefined;
		this.status = STOPPED;
		this.autoStart = options.autoStart;
		this.name = options.name;
		this.startCount = 0;
		this.stopTimeout = options.stopTimeout;

		var manifest = getManifest(options);
		if (log.isDebugEnabled()) {
			log.debug(manifest);
		}
		this.composer = new Hapi.Composer(manifest);

		process.on('exit', function() {
			log.info('exit');
			self.stop();
		});

		process.on('SIGTERM', function() {
			log.info('SIGTERM');
			self.stop(function() {
				process.exit(0);
			});

		});

		if (this.autoStart) {
			log.debug('AUTO STARTING');
			self.start();
		}
	};

	util.inherits(HapiServer, events.AsyncEventEmitter);

	HapiServer.prototype.start = function(callback) {
		if (this.status === STOPPED) {
			log.debug("HapiServer.start");
			this.serverDomain = domain.create();
			var self = this;

			this.serverDomain.on('error', function(error) {
				log.error('Unexpected error - process will exit : ' + error);
				self.stop();
				process.exit(1);
			});

			this.serverDomain.run(function() {
				var _start = function() {
					self.composer.start(function() {
						self.status = STARTED;
						self.startCount++;
						var info = {
							pid : process.pid,
							name : self.name,
							startCount : self.startCount
						};
						log.info('Hapi Server started : ' + JSON.stringify(info));
						self.emit('STARTED');
						if (callback) {
							setImmediate(callback);
						}
					});
				};

				if (self.startCount === 0) {
					try {
						self.composer.compose(function(err) {
							if (err) {
								log.error('Failed composing Hapi Server because a plugin failed to register : ' + err.message);
								if (callback) {
									setImmediate(callback.bind(null, err));
								}
							}
							log.info('Hapi Server is composed : ' + self.name);
							_start();
						});
					} catch (error) {
						if (callback) {
							setImmediate(callback.bind(null, error));
						}
					}
				} else {
					_start();
				}

			});

		} else {
			if (callback) {
				setImmediate(callback);
			}
			log.info('Hapi Server is already started');
		}
	};

	HapiServer.prototype.stop = function(callback) {
		if (this.status === STARTED) {
			var self = this;
			log.info('Stopping Hapi Server : ' + this.name);
			this.composer.stop({
				timeout : self.stopTimeout
			}, function() {
				self.status = STOPPED;
				log.info('Hapi Server stopped');
				self.emit('STOPPED');
				if (callback) {
					setImmediate(callback);
				}
				log.info('Disposing domain ...');
				self.serverDomain.exit();
				self.serverDomain.dispose();
				self.serverDomain = undefined;
				log.info('Disposed domain.');
			});
		} else {
			log.info('server is already stopped');
			if (callback) {
				setImmediate(callback);
			}
		}
	};

	module.exports = HapiServer;

}());
