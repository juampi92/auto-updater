var should = require('should');

var AutoUpdater = require('../auto-updater');

var EventEmitter = require('events').EventEmitter;

describe('Initialization', function() {
  it('should create a new instance', function() {
    var instance = new AutoUpdater();
  });
  it('should inherit EventEmitter', function() {
    var instance = new AutoUpdater();
    instance.should.be.an.instanceOf(EventEmitter);
  });

});