var should = require('should');

var AutoUpdater = require('../auto-updater');

describe('Diff Dependencies', function() {

  var instance = new AutoUpdater({
    devmode: true
  });

  instance.jsons = {
    client: {
      "version": "0.0.4",
      "dependencies": {
        "adm-zip": "*",
        "underscore": "^0.8.3"
      }
    },
    remote: {
      "version": "0.1.1",
      "dependencies": {
        "adm-zip": "*",
        "node-promise": "^0.5.12",
        "underscore": "^1.8.3"
      }
    }
  };

  var ret;
  it('should fire the command', function() {
    ret = instance.fire('diff-dependencies');
    ret.should.be.an.instanceOf(Array);
  });

  it('should compare the right dependencies', function() {
    ret.should.have.lengthOf(2);
    ret.should.eql(['node-promise', 'underscore']);
  });

});