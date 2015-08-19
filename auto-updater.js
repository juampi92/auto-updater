var fs = require('fs'),

  util = require('util'),
  path = require('path').posix,

  http = require('http'),
  https = require('https'),

  EventEmitter = require('events').EventEmitter;

var _ = require('underscore');

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
 * @event download.update
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
  devmode: false
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
 * @chainable
 */
AutoUpdater.prototype.fire = function(command) {
  commands[command].apply(this, _.toArray(arguments).slice(1));
  return this;
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
  emit(this, 'error', code, e);
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
   */
  'check': function() {
    // first check git if needed
    if (this.attrs.checkgit && checkGit.call(this)) return;

    loadClientJson.call(this);
  },
  /**
   * Downloads the latest zip
   * Fires:
   *   'update.not-installed' if the update exists but it wasn't installed
   *   'update.downloaded' if the update was successfully downloaded
   * @method download-update
   */
  'download-update': function() {
    var self = this;
    remoteDownloadUpdate.call(this, this.updateName, {
        host: this.attrs.contenthost,
        path: path.join(this.jsons.client['auto-updater'].repo,
          'zip',
          this.jsons.client['auto-updater'].branch)
      },
      function(existed) {
        if (existed === true)
          emit(self, 'update.not-installed');
        else
          emit(self, 'update.downloaded');

        if (self.opc.autoupdate) {
          self.fire('extract');
        }
      });
  },
  /**
   * Extracts the zip, replacing everything.
   * Fires:
   *   'update.extracted' when the extraction was successful
   *   'end' when the extraction was successful
   * @method extract
   */
  'extract': function() {
    var self = this;
    extract.call(this, this.updateName, false, function() {
      emit(self, 'update.extracted');
      emit(self, 'end');
    });
  },
  /**
   * Checks agains cache, and if not, calculates
   * @method diff-dependencies
   * @return {Boolean}
   */
  'diff-dependencies': function() {
    if (this.cache.dependencies === undefined) checkDependencies.call(this);
    return this.cache.dependencies_diff;
  }
};



/**
 * Reads the package.json
 * @method loadClientJson
 * @private
 */
var loadClientJson = function() {
  var jsonPath = path.join('.', this.attrs.pathToJson,
      'package.json'),
    self = this;

  fs.readFile(jsonPath, 'utf-8', function(err, data) {
    if (err) return;
    self.jsons.client = JSON.parse(data);
    loadRemoteJson.call(self);
  });
};

/**
 * Fetches and reads the remote package.json
 * @method loadRemoteJson
 * @private
 */
var loadRemoteJson = function() {
  var self = this,
    jsonPath = path.join(this.jsons.client['auto-updater'].repo,
      this.jsons.client['auto-updater'].branch,
      this.attrs.pathToJson,
      'package.json');

  remoteDownloader.call(this, {
    host: this.attrs.jsonhost,
    path: '/' + jsonPath
  }, function(err, data) {
    if (err) return;

    self.jsons.remote = data;
    self.updateName = self.update_dest + '-' + self.jsons.remote.version + '.zip';
    loaded.call(self);
  });
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
  if (this.jsons.client.version == this.jsons.remote.version) {
    emit(this, 'check.up-to-date', this.jsons.remote.version);
    emit(this, 'end');
  } else {
    emit(this, 'check.out-dated', this.jsons.client.version, this.jsons.remote.version);
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
 * @param  {Function} callback To call when it's done downloading
 * @private
 */
var remoteDownloader = function(opc, callback) {
  var self = this;

  if (!opc.host || !opc.path) return;

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
        error = e;
        data = null;
      }
      callback(error, data);
    });
  });

  request.on('error', function(e) {
    self.error('Error downloaing the remote JSON', 'download.error', e);
    callback(true);
  });

  request.end();
};

/**
 * Fires:
 *   'download.start'
 *   'download.update'
 *   'download.end'
 *   'download.error'
 * @method remoteDownloadUpdate
 * @param  {String} name Name of the update
 * @param  {Object} opc Download request options
 * @param  {Function} callback
 * @private
 */
var remoteDownloadUpdate = function(name, opc, callback) {
  var self = this;

  // Ya tengo el update. Falta instalarlo.
  if (fs.existsSync(name)) {
    callback(true);
    return;
  }

  // No tengo el archivo! Descargando!!
  var protocol;
  if (opc.ssh === false) protocol = http;
  else protocol = https;

  var reqGet = protocol.get(opc, function(res) {
    if (fs.existsSync('_' + name)) fs.unlinkSync('_' + name); // Empiezo denuevo.

    emit(self, 'download.start', name);

    var file = fs.createWriteStream('_' + name),
      len = parseInt(res.headers['content-length'], 10),
      current = 0;

    res.pipe(file);
    res.on('data', function(chunk) {
      //file.write(chunk);
      current += chunk.length;
      perc = (100.0 * (current / len)).toFixed(2);
      emit(self, 'download.update', name, perc);
    });
    res.on('end', function() {
      file.end();
    });

    file.on('finish', function() {
      fs.renameSync('_' + name, name);
      emit(self, 'download.end', name);

      callback();
    });
  });
  reqGet.end();
  reqGet.on('error', function(e) {
    emit(self, 'download.error', e);
  });
};

/**
 * 
 * @method extract
 * @param  {String}   name      Path of zip
 * @param  {Boolean}   subfolder If subfolder. (check Adm-zip)
 * @param  {Function} done  Return callback
 * @private
 */
var extract = function(name, subfolder, done) {
  var admzip = require('adm-zip');

  var zip = new admzip(name);
  var zipEntries = zip.getEntries(); // an array of ZipEntry records

  if (subfolder) {
    zip.extractAllTo('./', true);
  } else {
    zip.extractEntryTo(zipEntries[0], './', false, true);
  }

  fs.unlinkSync(name); // delete installed update.

  done();
};

/**
 * Iterates over the local and remote dependencies to check if they have changed
 * @method checkDependencies
 * @return {Boolean} If they have changed
 * @private
 */
var checkDependencies = function() { // return Bool
  if (!this.cache.dependencies) {
    if (this.jsons.client !== undefined && this.jsons.remote !== undefined) // ret undefined. No idea
      if (this.jsons.client.dependencies.length != this.jsons.remote.dependencies.length) this.cache.dependencies = false;
      else {
        bool = true;
        this.cache.dependencies_diff = [];
        for (var key in this.jsons.remote.dependencies) // Itero sobre las remotas. Si tengo demás en cliente, no es critico
          if (this.jsons.remote.dependencies[key] != this.jsons.client.dependencies[key]) { // Si no existe, tmb error
            this.cache.dependencies_diff.push(key); // Log the diff
            bool = false;
          }
        this.cache.dependencies = bool;
      }
  }
  return this.cache.dependencies;
};



module.exports = AutoUpdater;