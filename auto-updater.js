var fs = require('fs'),

  util = require('util'),
  path = require('path').posix,

  http = require('http'),
  https = require('https'),

  EventEmitter = require('events').EventEmitter;

var _ = require('underscore'),
  Defer = require('node-promise').defer;

/**
 * @class AutoUpdater
 * @extends event-emitter
 */
var AutoUpdater = function(config) {
  EventEmitter.apply(this);

  this.attrs = _.extend({}, AutoUpdater.defaults, config);
  this.update_dest = 'update';
  this.cache = {};
  this.jsons = {};
};

// Proto inheritance
util.inherits(AutoUpdater, EventEmitter);
AutoUpdater.prototype.emit = null;

/**
 * The user has a git clone. Recommend use the "git pull" command
 * @event git-clone
 */

/**
 * Versions match
 * @event check.up-to-date
 * @param {String} version Version number
 */

/**
 * Versions don't match
 * @event check.out-dated
 * @param {String} v_old Old (local) version number
 * @param {String} v New version number
 */

/**
 * Update downloaded in the machine
 * @event update.downloaded
 */

/**
 * Update was already in the dir, so it wasnt installed
 * @event update.not-installed
 */

/**
 * The update has been extracted correctly.
 * @event update.extracted
 */

/**
 * The download has started
 * @event download.start
 * @param {String} name Name of the update
 */

/**
 * The download has been updated. New percentage
 * @event download.progress
 * @param {String} name Name of the update
 * @param {Number} percent Percent of completion
 */

/**
 * The download has ended
 * @event download.end
 * @param {String} name Name of the update
 */

/**
 * Something happened to the download
 * @event download.error
 * @param {Error} e
 */

/**
 * Called when all is over
 * ( along with 'check.up-to-date' if there are no updates, or with 'update.extracted' if it was installed )
 * @event end
 */

AutoUpdater.defaults = {
  /**
   * @attribute pathToJson
   * @type {String}
   * @default ''
   */
  pathToJson: '',
  /**
   * @attribute autoupdate
   * @type {Boolean}
   * @default false
   */
  autoupdate: false,
  /**
   * @attribute checkgit
   * @type {Boolean}
   * @default false
   */
  checkgit: false,
  /**
   * @attribute jsonhost
   * @type {String}
   * @default 'raw.githubusercontent.com'
   */
  jsonhost: 'raw.githubusercontent.com',
  /**
   * @attribute contenthost
   * @type {String}
   * @default 'codeload.github.com'
   */
  contenthost: 'codeload.github.com',
  /**
   * @attribute devmode
   * @type {Boolean}
   * @default false
   */
  devmode: false,
  /**
   * If greater than 0, download progress gets debounced using this time (in ms)
   * @attribute progressDebounce
   * @type {Number}
   * @default 0
   */
  progressDebounce: 0
};

/**
 * Extra config
 * @method use
 * @param  {Object} options Custom options
 * @chainable
 */
AutoUpdater.prototype.use = function(options) {
  _.extend(this.attrs, options);
  return this;
};

/**
 * Fire commands
 * @method fire
 * @param  {String} command Name of command
 */
AutoUpdater.prototype.fire = function(command) {
  return commands[command].apply(this, _.toArray(arguments).slice(1));
};

/**
 * Error message handling
 *   (if debug mode, triggers console error)
 * @method error
 * @param  {String} message Description of the error
 * @param  {String} code    Error code
 * @param  {Exception} e       Error object
 * @private
 */
AutoUpdater.prototype.error = function(message, code, e) {
  if (this.attrs.devmode) {
    console.error(message);
  }
  emit(this, 'error', code, e || {});
};

/**
 * Emitts events
 * @method emit
 * @param  {Context} context Context of AutoUpdater
 * @private
 */
function emit(context) {
  EventEmitter.prototype.emit.apply(context, _.toArray(arguments).slice(1));
}

var commands = {
  /**
   * Checks packages versions (local and remote)
   * @method check
   * @chainable
   */
  'check': function() {
    // first check git if needed
    if (this.attrs.checkgit && checkGit.call(this)){
      return;
    }

    loadClientJson.call(this)
      .then(loadRemoteJson.bind(this))
      .then(loaded.bind(this));

    return this;
  },
  /**
   * Downloads the latest zip
   * Fires:
   *   'update.not-installed' if the update exists but it wasn't installed
   *   'update.downloaded' if the update was successfully downloaded
   * @method download-update
   * @chainable
   */
  'download-update': function() {
    // Validation
    if (!this.jsons.client) {
      return loadClientJson.call(this)
        .then(loadRemoteJson.bind(this))
        .then(commands['download-update'].bind(this));
    }

    var self = this,
      jsoninfo = this.jsons.client['auto-updater'];

    remoteDownloadUpdate.call(this, this.updateName, {
        host: this.attrs.contenthost,
        path: '/' + path.join(jsoninfo.repo,
          'zip',
          jsoninfo.branch)
      })
      .then(function(existed) {
        if (existed === true)
          emit(self, 'update.not-installed');
        else
          emit(self, 'update.downloaded');

        if (self.attrs.autoupdate) {
          self.fire('extract');
        }
      });
    return this;
  },
  /**
   * Extracts the zip, replacing everything.
   * Fires:
   *   'update.extracted' when the extraction was successful
   *   'end' when the extraction was successful
   * @method extract
   * @chainable
   */
  'extract': function(subfolder) {
    var self = this;
    extract.call(this, this.updateName, subfolder)
      .then(function() {
        emit(self, 'update.extracted');
        emit(self, 'end');
      });
    return this;
  },
  /**
   * Checks against cache, and if not, calculates
   * @method diff-dependencies
   * @return {Array}
   */
  'diff-dependencies': function() {
    if (!this.cache.dependencies) {
      checkDependencies.call(this);
    }
    return this.cache.dependencies;
  }
};

/**
 * Parses and filters package.json
 * @method parsePackageJson
 * @param  {String || Object} data Parsed or raw package.json
 * @return {Object} Object containing only 'auto-updater', 'version' and 'dependencies'
 * @private
 */
var parsePackageJson = function(data) {
  if (!_.isObject(data)) {
    data = JSON.parse(data);
  }
  // Validation
  if (!data['auto-updater']) {
    this.error('Invalid package.json. No auto-updater field', 'json.error');
    throw 'error';
  }

  var filtered = _.pick(data, 'auto-updater', 'version', 'dependencies');
  return filtered;
};

/**
 * Fires:
 *   'git-clone' if it has a .git folder
 * @method _checkGit
 * @return {Boolean}  Has git folder
 * @private
 */
var checkGit = function() {
  if (this.cache.git === undefined) {

    this.cache.git = fs.existsSync('.git');

    if (this.cache.git === true) {
      emit('git-clone');
    }
  }
  return this.cache.git;
};
/**
 * Reads the package.json
 * @method loadClientJson
 * @return {Promise}
 * @private
 */
var loadClientJson = function() {
  var jsonPath = path.join('.', this.attrs.pathToJson,
      'package.json'),
    self = this,
    deferred = Defer();

  fs.readFile(jsonPath, 'utf-8', function(err, data) {
    if (err) {
      deferred.reject();
      return;
    }
    self.jsons.client = parsePackageJson.call(self, data);

    deferred.resolve();
  });
  return deferred;
};

/**
 * Fetches and reads the remote package.json
 * @method loadRemoteJson
 * @return {Promise}
 * @private
 */
var loadRemoteJson = function() {
  var self = this,
    jsoninfo = self.jsons.client['auto-updater'],
    repo = jsoninfo.repo,
    branch = jsoninfo.branch,
    jsonPath = path.join(repo,
      branch,
      this.attrs.pathToJson,
      'package.json'),
    deferred = Defer();

  remoteDownloader.call(this, {
      host: this.attrs.jsonhost,
      path: '/' + jsonPath
    })
    .then(function(data) {
      self.jsons.remote = parsePackageJson.call(self, data);
      self.updateName = self.update_dest + '-' + self.jsons.remote.version + '.zip';

      deferred.resolve();
    }, deferred.reject.bind(deferred));
  return deferred;
};

/**
 *
 * Fires:
 *   'check.up-to-date' if local version and remote version match
 *   'end' cause it finished checking
 *   'check.out-dated' if the versions don't match
 * @method loaded
 * @private
 */
var loaded = function() {
  var clientVersion = this.jsons.client.version,
    remoteVersion = this.jsons.remote.version;

  if (clientVersion === remoteVersion) {
    emit(this, 'check.up-to-date', remoteVersion);
    emit(this, 'end');
  } else {
    emit(this, 'check.out-dated', clientVersion, remoteVersion);
    if (this.attrs.autoupdate) {
      this.fire('download-update');
    }
  }
};

/**
 * Fires:
 *   'download.error' In case the download fails
 * @method remoteDownloader
 * @param  {[type]} opc      Object containing host, path and method of the download
 * @return {Promise}
 * @private
 */
var remoteDownloader = function(opc, callback) {
  if (!opc.host || !opc.path) return;

  var self = this,
    deferred = Defer();

  var request = https.request(opc, function(res) {

    var data = '';

    res.on('data', function(d) {
      data = data + d;
    });

    res.on('end', function() {
      var error = null;
      try {
        data = JSON.parse(data);
      } catch (e) {
        self.error('Error reading the dowloaded JSON: ' + data, 'download.error', {
          e: e,
          response: data,
          path: opc.path,
          host: opc.host
        });
        deferred.reject(e);
        return;
      }
      deferred.resolve(data);
    });

  });

  request.on('error', function(e) {
    self.error('Error downloaing the remote JSON', 'download.error', e);
    deferred.reject();
  });

  request.end();
  return deferred;
};

/**
 * Fires:
 *   'download.start'
 *   'download.progress'
 *   'download.end'
 *   'download.error'
 * @method remoteDownloadUpdate
 * @param  {String} name Name of the update
 * @param  {Object} opc Download request options
 * @return {Promise}
 * @private
 */
var remoteDownloadUpdate = function(name, opc) {
  var self = this,
    deferred = Defer();

  // Ya tengo el update. Falta instalarlo.
  if (fs.existsSync(name)) {
    deferred.resolve(true);
    return deferred;
  }

  // No tengo el archivo! Descargando!!
  var protocol;
  if (opc.ssh === false) protocol = http;
  else protocol = https;

  // download request
  var request = protocol.get(opc, function(res) {
    // Check if the file already exists and remove it if it does
    if (fs.existsSync('_' + name)) fs.unlinkSync('_' + name);

    // Download started
    emit(self, 'download.start', name);

    // Writestream for the binary file
    var file = fs.createWriteStream('_' + name),
      len = parseInt(res.headers['content-length'], 10),
      current = 0;

    // Pipe any new block to the stream
    res.pipe(file);

    var dataRecieve = function(chunk) {
      current += chunk.length;
      perc = (100.0 * (current / len)).toFixed(2);
      emit(self, 'download.progress', name, perc);
    };

    if (self.attrs.progressDebounce) {
      res.on('data', _.debounce(dataRecieve, self.attrs.progressDebounce));
    } else {
      res.on('data', dataRecieve);
    }

    res.on('end', function() {
      file.end();
    });

    file.on('finish', function() {
      fs.renameSync('_' + name, name);
      emit(self, 'download.end', name);

      deferred.resolve();
    });
  });
  request.end();
  request.on('error', function(e) {
    deferred.reject();
    emit(self, 'download.error', e);
  });

  return deferred;
};

/**
 * 
 * @method extract
 * @param  {String}   name      Path of zip
 * @param  {Boolean}   subfolder If subfolder. (check Adm-zip)
 * @return {Promise}
 * @private
 */
var extract = function(name, subfolder) {
  var admzip = require('adm-zip');

  var zip = new admzip(name);
  var zipEntries = zip.getEntries(); // an array of ZipEntry records
  var deferred = Defer();

  if (subfolder) {
    zip.extractAllTo('./', true);
  } else {
    zip.extractEntryTo(zipEntries[0], './', false, true);
  }

  fs.unlink(name, deferred.resolve.bind(deferred));
  return deferred;
};

/**
 * Iterates over the local and remote dependencies to check if they have changed
 * @method checkDependencies
 * @return {Boolean} If they have changed
 * @private
 */
var checkDependencies = function() {
  var client = this.jsons.client.dependencies,
    remote = this.jsons.remote.dependencies,
    cache = this.cache;

  if (!client || !remote) {
    this.error('Error: you need to check the jsons before checking dependencies', 'dependencies.error');
    return;
  }

  cache.dependencies = [];

  _.each(remote, function(value, key) {
    // Check that the client has the key, or that the versions are the same
    if (!client.hasOwnProperty(key) ||
      value !== client[key]) {
      // Log the diff
      cache.dependencies.push(key);
    }
  });
  return (cache.dependencies.length > 0);
};

module.exports = AutoUpdater;
