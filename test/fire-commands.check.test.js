var should = require('should');
var fs = require('fs');

var AutoUpdater = require('../auto-updater');


describe('Fire Commands: Check', function() {

  // CHECK UP-TO-DATE
  describe('Check up-to-date', function() {
    var instance = new AutoUpdater({
      pathToJson: '/test/assets/',
      devmode: true
    });

    var result, version;
    beforeEach(function(done) {
      this.timeout(5000);
      instance.on('error', function(name, e) {
        console.error(e);
        result = 'error';
        done();
      });
      instance.on('check.up-to-date', function(v) {
        version = v;
        result = 'check.up-to-date';
        done();
      });
      instance.on('check.out-dated', function(v1, v2) {
        result = 'check.out-dated';
        done();
      });

      instance.fire('check');
    });

    it('should check JSONS and version', function() {
      result.should.be.exactly('check.up-to-date');
      version.should.be.exactly('0.1.0');
    });
  });

  // Check OUT-DATED
  describe('Check out-dated', function() {

    var instance2 = new AutoUpdater({
      pathToJson: 'test/assets/older/',
      devmode: true
    });

    var result, v1, v2;
    beforeEach(function(done) {
      var fd = fs.openSync('./test/assets/older/package.json', 'w');
      fs.writeSync(fd, JSON.stringify({
        'version': '0.0.5',
        'auto-updater': {
          'repo': 'juampi92/auto-updater',
          'branch': 'v1.0.0'
        }
      }, null, 2));

      instance2.on('error', function(name, e) {
        console.error(e);
        result = 'error';
        done();
      });
      instance2.on('check.up-to-date', function(v) {
        result = 'check.up-to-date';
        done();
      });
      instance2.on('check.out-dated', function(_v1, _v2) {
        v1 = _v1;
        v2 = _v2;
        result = 'check.out-dated';
        done();
      });

      instance2.fire('check');
    });

    afterEach(function() {
      var fd = fs.openSync('./test/assets/older/package.json', 'w');
      fs.writeSync(fd, JSON.stringify({
        'version': '0.0.4',
        'auto-updater': {
          'repo': 'juampi92/auto-updater',
          'branch': 'v1.0.0'
        }
      }, null, 2));
    });

    it('should check JSONS and versions', function() {
      result.should.be.exactly('check.out-dated');
      v1.should.be.exactly('0.0.5');
      v2.should.be.exactly('0.0.4');
    });
  });

});