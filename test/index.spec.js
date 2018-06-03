var Camera = require('../')

describe('Camera static method', function() {
  // To finish testings, you must have at least one camera devices at /dev/video*
  describe('#listDevices', function() {
    test('find devices at /dev/video*', function(done) {
      Camera.listDevices(function(err, devices) {
        expect(err).toBeNull();
        expect(devices[0]).toMatch('/dev/video');
        done();
      })
    }); }); 
  describe('#hasCamera', function() {
    test('ture when have camera at /dev/video*', function(done) {
      Camera.hasCamera(function(err, ok) {
        expect(err).toBeNull();
        expect(ok).toBe(true);
        done();
      })
    });
  });

  describe('#capture', function() {
    test('captures the photo at /dev/video0 and returns buffer', function(done) {
      Camera.capture(function(err, buf) {
        expect(err).toBeNull();
        expect(buf).toBeDefined();
        done();
      })
    });
    test('captures the photo and returns file location', function(done) {
      var location = '/tmp/photo-' + Math.random().toString().slice(2, 8)
      Camera.capture(location, function(err, savedFile) {
        expect(err).toBeNull();
        expect(savedFile).toBe(location + '.jpg');
        done();
      })
    });
  })
});