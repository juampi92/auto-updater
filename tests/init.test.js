var should = require('should');

var AutoUpdater = require('../auto-updater');

var EventEmitter = require('events').EventEmitter;

describe('Basic Initialization', function() {

  var instance = new AutoUpdater();

  it('should inherit EventEmitter', function() {
    instance.should.be.an.instanceOf(EventEmitter);
  });

  it('should have the default values', function() {
    instance.should.have.property('attrs');

    instance.attrs.pathToJson.should.be.exactly('');
    instance.attrs.autoupdate.should.be.exactly(false);
    instance.attrs.checkgit.should.be.exactly(false);
    instance.attrs.jsonhost.should.be.exactly('raw.githubusercontent.com');
    instance.attrs.contenthost.should.be.exactly('codeload.github.com');
    instance.attrs.devmode.should.be.exactly(false);
  });

  it('should change properties using use', function() {
    instance.use({
      pathToJson: '../',
      autoupdate: true,
      checkgit: true
    });

    instance.attrs.pathToJson.should.be.exactly('../');
    instance.attrs.autoupdate.should.be.exactly(true);
    instance.attrs.checkgit.should.be.exactly(true);
  });

});