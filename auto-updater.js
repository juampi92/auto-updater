var fs = require('fs'),
  http = require('http'),
  https = require('https'),
  EventEmitter = require('events').EventEmitter;

module.exports = function(config) {

  var AutoUpdater = new EventEmitter();

  AutoUpdater.init = function(options) {
    this.jsons = [];
    this.opt = [];
    this.update_dest = 'update';
    this.cache = {};

    this.opt.pathToJson = (options && options.pathToJson && !options.pathToJson) ? (options.pathToJson) : '';
    this.opt.async = true; //(options && options.async == false) ? false : true; // No support for https response sync.
    this.opt.silent = (options && options.silent) || false; // No advierte eventos
    this.opt.autoupdate = (options && options.autoupdate) ? true : false; // Descarga automáticamente la nueva versión
    this.opt.check_git = (options && options.check_git) ? true : false;
    //this.opt.autocheck = (options.autocheck == false) ? false : true; // Revisa al inicializarse. No da tiempo a setear los eventos
  };

  AutoUpdater.forceCheck = function() {
    var self = this;

    // CheckGit
    if (this.opt.check_git && this._checkGit()) return;

    this._loadClientJson();
  };

  AutoUpdater.forceDownloadUpdate = function() {
    var self = this;
    this._remoteDownloadUpdate(this.updateName, {
        host: 'codeload.github.com',
        path: this.jsons.client['auto-updater'].repo + '/zip/' + this.jsons.client['auto-updater'].branch
      },
      function(existed) {
        if (existed === true)
          self.emit('update-not-installed');
        else
          self.emit('update-downloaded');

        if (self.opc.autoupdate) self.forceExtract();
      });
  };

  AutoUpdater.forceExtract = function() {
    var self = this;
    this._extract(this.updateName, false, function() {
      self.emit('extracted');
      self.emit('end');
    });
  };

  AutoUpdater._checkGit = function() {
    if (this.cache.git === undefined) {
      this.cache.git = fs.existsSync('.git');
      if (this.cache.git === true) {
        this.emit('git-clone');
      }
    }
    return this.cache.git;
  };

  AutoUpdater._loadClientJson = function() {
    var path = this.opt.pathToJson + './package.json',
      self = this;

    if (!this.opt.async) { // Sync
      this.jsons.client = JSON.parse(fs.readFileSync(path));
      this._loadRemoteJson();
    } else { // Async
      fs.readFile(path, function(err, data) {
        if (err) throw err;
        self.jsons.client = JSON.parse(data);
        self._loadRemoteJson();
      });
    }
  };

  AutoUpdater._loadRemoteJson = function() {
    var self = this,
      path = this.jsons.client['auto-updater'].repo + '/' + this.jsons.client['auto-updater'].branch + '/' + this.opt.pathToJson + 'package.json';


    this._remoteDownloader({
      host: 'raw.githubusercontent.com',
      path: path
    }, function(data) {
      self.jsons.remote = JSON.parse(data);
      self.updateName = self.update_dest + '-' + self.jsons.remote.version + '.zip';
      self._loaded();
    });
  };

  AutoUpdater._loaded = function() {
    if (this.jsons.client.version == this.jsons.remote.version) {
      this.emit('check-up-to-date', this.jsons.remote.version);
      this.emit('end');
    } else {
      this.emit('check-out-dated', this.jsons.client.version, this.jsons.remote.version);
      if (this.opt.autoupdate) this.forceDownloadUpdate();
    }
  };

  AutoUpdater._remoteDownloader = function(opc, callback) {
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
      self.emit('download-error', e);
    });
    reqGet.end();
  };

  AutoUpdater._remoteDownloadUpdate = function(name, opc, callback) {
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

      self.emit('download-start', name);

      var file = fs.createWriteStream('_' + name),
        len = parseInt(res.headers['content-length'], 10),
        current = 0;

      res.pipe(file);
      res.on('data', function(chunk) {
        //file.write(chunk);
        current += chunk.length;
        perc = (100.0 * (current / len)).toFixed(2);
        self.emit('download-update', name, perc);
      });
      res.on('end', function() {
        file.end();
      });

      file.on('finish', function() {
        fs.renameSync('_' + name, name);
        self.emit('download-end', name);

        // Call callback
        callback();
        //res.end('done');
      });
    });
    reqGet.end();
    reqGet.on('error', function(e) {
      self.emit('download-error', e);
    });
  };

  AutoUpdater._extract = function(name, subfolder, callback) {
    var admzip = require('adm-zip');

    var zip = new admzip(name);
    var zipEntries = zip.getEntries(); // an array of ZipEntry records

    if (subfolder) {
      zip.extractAllTo('./', true);
    } else {
      zip.extractEntryTo(zipEntries[0], './', false, true);
    }

    fs.unlinkSync(name); // delete installed update.

    callback();
  };

  AutoUpdater.checkDependencies = function() { // return Bool
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

  AutoUpdater.diffDependencies = function() {
    if (this.cache.dependencies === undefined) this.checkDependencies();
    return this.cache.dependencies_diff;
  };

  // Run:
  AutoUpdater.init(config);

  return AutoUpdater;
};