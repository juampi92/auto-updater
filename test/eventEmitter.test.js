var should = require('should');

var AutoUpdater = require('../auto-updater');

describe('Event Emitter', function() {

  var instance = new AutoUpdater();

  it('should have methods', function() {
    instance.should.have.properties('on', 'addListener', 'on', 'once', 'removeListener', 'removeAllListeners', 'setMaxListeners', 'listeners', 'emit');
  });

  it('should add listeners', function() {
    var testCallback = function() {};
    instance.on('test', testCallback);

    var tests = instance.listeners('test');

    tests.length.should.be.exactly(1);
    tests[0].should.be.exactly(testCallback);

    var testCallback2 = function() {};
    instance.on('test', testCallback2);

    tests = instance.listeners('test');
    tests.length.should.be.exactly(2);
    tests[0].should.be.exactly(testCallback);
    tests[1].should.be.exactly(testCallback2);
  });

  it('should delete listeners', function() {
    var testCallback = function() {};
    instance.on('testA', testCallback);

    instance.listeners('testA').length.should.be.exactly(1);
    instance.removeListener('testA', testCallback);
    instance.listeners('testA').length.should.be.exactly(0);

    instance.on('testB', testCallback);
    instance.on('testB', testCallback);
    instance.on('testB', testCallback);
    instance.listeners('testB').length.should.be.exactly(3);
    instance.removeAllListeners('testB');
    instance.listeners('testB').length.should.be.exactly(0);
  });

  it('should have emit disabled', function() {
    should(instance.emit).be.exactly(null);
  });
});