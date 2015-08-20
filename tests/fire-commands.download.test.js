var should = require('should');
var fs = require('fs');

var AutoUpdater = require('../auto-updater');


describe('Fire Commands: Download', function() {

  describe('Download update', function() {

    var instance = new AutoUpdater({
      pathToJson: 'tests/assets/',
      devmode: true,
      progressDebounce: 5
    });

    it('starting download', function() {});

    instance.on('download.progress', function (n, perc) {
      // Used to test debounce
      //console.log(perc)
    });

    it('should download and check ', function(done) {
      instance.on('update.not-installed', function(name) {
        throw 'update.not-installed';
        done();
      });
      instance.on('update.downloaded', function() {
        done();
      });
      instance.on('error', function(e) {
        throw 'Error' + e;
      });

      instance.fire('download-update');

    });
    it('should have the file', function() {
      instance.updateName.should.be.exactly('update-0.1.0.zip');
      fs.existsSync(instance.updateName).should.be.exactly(true);
    });

    it('should remove the update file', function() {
      fs.unlinkSync(instance.updateName);
    })
  });

});