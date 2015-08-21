var should = require('should');
var fs = require('fs');

var AutoUpdater = require('../auto-updater');

describe('Fire Commands: Extract', function() {

  var instance = new AutoUpdater({
    pathToJson: 'tests/assets/',
    devmode: true,
    progressDebounce: 0
  });

  instance.jsons = {
    client: {
      "version": "0.0.4",
      "auto-updater": {
        "repo": "juampi92/auto-updater",
        "branch": "v1.0.0"
      }
    },
    remote: {
      "version": "0.1.1",
      "auto-updater": {
        "repo": "juampi92/auto-updater",
        "branch": "v1.0.0"
      }
    }
  };
  instance.updateName = 'tests/assets/' + instance.update_dest + '-' + instance.jsons.remote.version;

  it('should copy the update', function(done) {
    this.timeout(3000);
    fs.createReadStream(instance.updateName + '_save')
      .pipe(fs.createWriteStream(instance.updateName + '.zip')
        .on('close', function() {
          done();
          instance.updateName += '.zip';
        }));
  });

  it('should have the update ready', function() {
    fs.existsSync(instance.updateName).should.be.exactly(true);
  });

  it('should extract', function(done) {
    this.timeout(5000);
    instance.on('update.extracted', function(name) {
      done();
    });
    instance.on('error', function(e) {
      throw 'Error' + e;
    });

    instance.fire('extract');
  });

  var fileCreated = 'tests/assets/updatedfile.js';

  it('should have the file', function() {
    fs.existsSync(fileCreated).should.be.exactly(true);
  });

  it('should remove the update file', function() {
    fs.unlinkSync(fileCreated);
  });

});