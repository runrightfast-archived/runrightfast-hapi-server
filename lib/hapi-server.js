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
 * NOTE: once a server is stopped, it cannot be restarted. A new instance of the
 * server will need to be created.
 * 
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
 *  stopTimeout : 5 * 1000, // OPTIONAL - the timeout in millisecond before forcefully terminating a connection. Defaults to 5000 (5 seconds). 
 *  name: 'runrightfast-hapi-server', // OPTIONAL - server name, which is also used as the logger name. Defaults to 'runrightfast-hapi-server'.
 *  logLevel: 'WARN' // OPTIONAL - specifies the level of logging by the Hapi Server. Defaults to 'WARN',
 *  startCallback : function(err){}, //OPTIONAL
 *  stopCallback : function(){} //OPTIONAL
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

		var mergeOptionsWithDefaults = function() {
			var defaultOptions = {
				autoStart : true,
				stopTimeout : 5 * 1000,
				name : 'runrightfast-hapi-server',
				logLevel : 'WARN'
			};
			options = extend(defaultOptions, options);
			logging.setLogLevel(log, options.logLevel);
			log.debug(options);
		};

		var validateOptions = function() {
			assert(lodash.isString(options.name), 'options.name must be a String');
			assert(lodash.isBoolean(options.autoStart), 'options.autoStart must be a boolean');
			assert(lodash.isNumber(options.stopTimeout) && options.stopTimeout >= 0, 'options.stopTimeout must be a Number >= 0');
			if (!lodash.isUndefined(options.startCallback)) {
				assert(lodash.isFunction(options.startCallback), 'options.startCallback must be a function');
			}
			if (!lodash.isUndefined(options.stopCallback)) {
				assert(lodash.isFunction(options.stopCallback), 'options.stopCallback must be a function');
			}
		};

		var getManifest = function getManifest(options) {
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

		assert(!lodash.isUndefined(options), 'options are required');
		assert(!lodash.isUndefined(options.manifest), 'options.manifest is required');

		mergeOptionsWithDefaults();
		validateOptions();

		this.serverDomain = undefined;
		this.status = STOPPED;
		this.autoStart = options.autoStart;
		this.name = options.name;
		this.startCount = 0;
		this.stopTimeout = options.stopTimeout;
		this.startCallback = options.startCallback;
		this.stopCallback = options.stopCallback;
		var manifest = getManifest(options);

		if (log.isDebugEnabled()) {
			log.debug(manifest);
		}
		this.composer = new Hapi.Composer(manifest);

		this._processListeners = {
			onSIGTERM : function() {
				log.info('SIGTERM');
				self.stop(function() {
					process.exit(0);
				});
			}.bind(self),
			onSIGINT : function() {
				log.info('SIGINT');
				self.stop(function() {
					process.exit(0);
				});
			}.bind(self),
			onExit : function() {
				log.info('exit');
				self.stop();
			}.bind(self)
		};

		if (this.autoStart) {
			log.debug('AUTO STARTING');
			self.start(options.startCallback);
		}
	};

	util.inherits(HapiServer, events.AsyncEventEmitter);

	HapiServer.prototype.registerListeners = function() {
		log.debug('registerListeners()');
		process.on('exit', this._processListeners.onExit);
		process.on('SIGTERM', this._processListeners.onSIGTERM);
		process.on('SIGINT', this._processListeners.onSIGINT);
	};

	HapiServer.prototype.removeListeners = function() {
		log.debug('removeListeners()');
		process.removeListener('exit', this._processListeners.onExit);
		process.removeListener('SIGTERM', this._processListeners.onSIGTERM);
		process.removeListener('SIGINT', this._processListeners.onSIGINT);
		this.removeAllListeners();
	};

	/**
	 * 
	 * @param callback
	 * @throws Error
	 *             if trying to restart the server
	 */
	HapiServer.prototype.start = function(callback) {
		var self = this;

		var invokeCallbacks = function(error) {
			if (lodash.isUndefined(error)) {
				if (callback) {
					process.nextTick(callback);
				}
				if (self.startCallback) {
					process.nextTick(self.startCallback);
				}
			} else {
				if (callback) {
					process.nextTick(callback.bind(null, error));
				}
				if (self.startCallback) {
					process.nextTick(self.startCallback.bind(null, error));
				}
			}
		};

		if (this.status === STOPPED) {
			log.debug("HapiServer.start");
			this.serverDomain = domain.create();

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
						invokeCallbacks();
					});
				};

				self.registerListeners();

				if (self.startCount === 0) {
					try {
						self.composer.compose(function(err) {
							if (err) {
								log.error('Failed composing Hapi Server because a plugin failed to register : ' + err);
								invokeCallbacks(err);
							} else {
								log.info('Hapi Server is composed : ' + self.name);
								_start();
							}
						});
					} catch (error) {
						invokeCallbacks(error);
					}
				} else {
					_start();
				}

			});

		} else if (this.status === STARTED) {
			if (callback) {
				process.nextTick(callback);
			}
			if (this.startCallback) {
				process.nextTick(this.startCallback);
			}
			log.info('Hapi Server is already started');
		} else {
			var error = new Error('Hapi Server cannot be restarted - create a new instance if you really want to start the server again in the same process');
			if (callback) {
				process.nextTick(callback.bind(null, error));
			}
			if (this.startCallback) {
				process.nextTick(this.startCallback.bind(null, error));
			}
			throw error;
		}
	};

	HapiServer.prototype.stop = function(callback) {
		var self = this;
		var invokeCallbacks = function() {
			if (callback) {
				process.nextTick(callback);
			}
			if (self.stopCallback) {
				process.nextTick(self.stopCallback);
			}
		};

		if (this.status === STARTED) {
			log.info('Stopping Hapi Server : ' + self.name);
			this.composer.stop({
				timeout : self.stopTimeout
			}, function() {
				self.status = STOPPED;
				log.info('Hapi Server stopped');
				self.emit('STOPPED');
				log.info('Disposing domain : ' + self.name);
				self.serverDomain.exit();
				self.serverDomain.dispose();
				self.serverDomain = undefined;
				log.info('Disposed domain : ' + self.name);
				self.status = undefined;
				self.removeListeners();
				invokeCallbacks();
			});
		} else {
			if (log.isDebugEnabled()) {
				log.debug('server is already stopped : ' + this.name);
			}
			invokeCallbacks();
		}
	};

	module.exports = HapiServer;

}());
