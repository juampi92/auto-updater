var fs = require('fs'),
  http = require('http'),
  https = require('https'),
  util = require('util'),
  EventEmitter = require('events').EventEmitter;

var _ = require('underscore');

/**
 * @class AutoUpdater
 * @extends event-emitter
 */
var AutoUpdater = function(config) {
  EventEmitter.call(this);

  this.attrs = _.extend({}, AutoUpdater.defaults, config);
  this.update_dest = 'update';
  this.cache = {};
  this.jsons = {};
};

// Proto inheritance
util.inherits(AutoUpdater, EventEmitter);

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
 */
AutoUpdater.prototype.use = function(options) {
  _.extend(this.attrs, options);
};

/**
 * Checks packages versions (local and remote)
 * @method forceCheck
 */
AutoUpdater.prototype.forceCheck = function() {
  var self = this;

  // CheckGit
  if (this.attrs.checkgit && this._checkGit()) return;

  this._loadClientJson();
};

/**
 * Downloads the latest zip
 * Fires:
 *   'update.not-installed' if the update exists but it wasn't installed
 *   'update.downloaded' if the update was successfully downloaded
 * @method forceDownloadUpdate
 */
AutoUpdater.prototype.forceDownloadUpdate = function() {
  var self = this;
  this._remoteDownloadUpdate(this.updateName, {
      host: this.attrs.contenthost,
      path: this.jsons.client['auto-updater'].repo + '/zip/' + this.jsons.client['auto-updater'].branch
    },
    function(existed) {
      if (existed === true)
        self.emit('update.not-installed');
      else
        self.emit('update.downloaded');

      if (self.opc.autoupdate) {
        self.forceExtract();
      }
    });
};

/**
 * Extracts the zip, replacing everything.
 * Fires:
 *   'update.extracted' when the extraction was successful
 *   'end' when the extraction was successful
 * @method forceExtract
 * @return {[type]}     [description]
 */
AutoUpdater.prototype.forceExtract = function() {
  var self = this;
  this._extract(this.updateName, false, function() {
    self.emit('update.extracted');
    self.emit('end');
  });
};

/**
 * Fires:
 *   'git-clone' if it has a .git folder
 * @method _checkGit
 * @return {Boolean}  Has git folder
 * @private
 */
AutoUpdater.prototype._checkGit = function() {
  if (this.cache.git === undefined) {
    this.cache.git = fs.existsSync('.git');
    if (this.cache.git === true) {
      this.emit('git-clone');
    }
  }
  return this.cache.git;
};

/**
 * Reads the package.json
 * @method _loadClientJson
 * @private
 */
AutoUpdater.prototype._loadClientJson = function() {
  var path = this.attrs.pathToJson + './package.json',
    self = this;

  fs.readFile(path, function(err, data) {
    if (err) throw err;
    self.jsons.client = JSON.parse(data);
    self._loadRemoteJson();
  });
};

/**
 * Fetches and reads the remote package.json
 * @method _loadRemoteJson
 * @private
 */
AutoUpdater.prototype._loadRemoteJson = function() {
  var self = this,
    path = this.jsons.client['auto-updater'].repo + '/' + this.jsons.client['auto-updater'].branch + '/' + this.attrs.pathToJson + 'package.json';


  this._remoteDownloader({
    host: this.attrs.jsonhost,
    path: path
  }, function(data) {
    self.jsons.remote = JSON.parse(data);
    self.updateName = self.update_dest + '-' + self.jsons.remote.version + '.zip';
    self._loaded();
  });
};

/**
 *
 * Fires:
 *   'check.up-to-date' if local version and remote version match
 *   'end' cause it finished checking
 *   'check.out-dated' if the versions don't match
 * @method _loaded
 * @private
 */
AutoUpdater.prototype._loaded = function() {
  if (this.jsons.client.version == this.jsons.remote.version) {
    this.emit('check.up-to-date', this.jsons.remote.version);
    this.emit('end');
  } else {
    this.emit('check.out-dated', this.jsons.client.version, this.jsons.remote.version);
    if (this.attrs.autoupdate) this.forceDownloadUpdate();
  }
};

/**
 * Fires:
 *   'download.error' In case the download fails
 * @method _remoteDownloader
 * @param  {[type]} opc      Object containing host, path and method of the download
 * @param  {Function} callback To call when it's done downloading
 * @private
 */
AutoUpdater.prototype._remoteDownloader = function(opc, callback) {
  var self = this;

  if (!opc.host || !opc.host) return;
  if (!opc.path || !opc.path) return;
  opc.method = (!opc.method) ? 'GET' : opc.method;

  var reqGet = https.request(opc, function(res) {
    var data = '';
    res.on('data', function(d) {
      data = data + d;
    });
    res.on('end', function() {
      callback(data);
    });
  });
  reqGet.on('error', function(e) {
    self.emit('download.error', e);
  });
  reqGet.end();
};

/**
 * Fires:
 *   'download.start'
 *   'download.update'
 *   'download.end'
 *   'download.error'
 * @method _remoteDownloadUpdate
 * @param  {String} name Name of the update
 * @param  {Object} opc Download request options
 * @param  {Function} callback
 * @private
 */
AutoUpdater.prototype._remoteDownloadUpdate = function(name, opc, callback) {
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

    self.emit('download.start', name);

    var file = fs.createWriteStream('_' + name),
      len = parseInt(res.headers['content-length'], 10),
      current = 0;

    res.pipe(file);
    res.on('data', function(chunk) {
      //file.write(chunk);
      current += chunk.length;
      perc = (100.0 * (current / len)).toFixed(2);
      self.emit('download.update', name, perc);
    });
    res.on('end', function() {
      file.end();
    });

    file.on('finish', function() {
      fs.renameSync('_' + name, name);
      self.emit('download.end', name);

      callback();
    });
  });
  reqGet.end();
  reqGet.on('error', function(e) {
    self.emit('download.error', e);
  });
};

/**
 * 
 * @method _extract
 * @param  {String}   name      Path of zip
 * @param  {Boolean}   subfolder If subfolder. (check Adm-zip)
 * @param  {Function} done  Return callback
 * @private
 */
AutoUpdater.prototype._extract = function(name, subfolder, done) {
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
 * @method _checkDependencies
 * @return {Boolean} If they have changed
 * @private
 */
AutoUpdater.prototype._checkDependencies = function() { // return Bool
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

/**
 * Checks agains cache, and if not, calculates
 * @method diffDependencies
 * @return {Boolean}
 */
AutoUpdater.prototype.diffDependencies = function() {
  if (this.cache.dependencies === undefined) this._checkDependencies();
  return this.cache.dependencies_diff;
};

module.exports = AutoUpdater;