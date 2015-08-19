var should = require('should');

var AutoUpdater = require('../auto-updater');

describe('Fire Commands', function() {

  var instance = new AutoUpdater({
    pathToJson: '/tests/assets/',
    devmode: true
  });

  describe('check', function() {
    var result;
    beforeEach(function(done) {
      instance.on('error', function(name, e) {
        console.log(e);
        result = 'error';
        done();
      });
      instance.on('check.up-to-date', function(v) {
        result = 'check.up-to-date';
        done();
      });
      instance.on('check.out-dated', function(v1, v2) {
        result = 'check.out-dated';
        done();
      });

    });
    instance.fire('check');

    it('should check JSONS', function() {
      result.should.not.be.exactly('error');
      console.log(result);
    });
  });


});