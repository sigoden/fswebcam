var fs = require('fs');
var merge = require('deepmerge');
var exec = require('child_process').exec;

var EXEC_BIN = 'fswebcam';

var OPTIONS = {
  loop: 'number',
  offset: 'number',
  background: 'boolean',
  pid: 'string',
  log: 'string',
  input: 'string',
  tuner: 'string',
  frequency: 'number',
  palette: 'string',
  delay: 'number',
  resolution: 'string',
  fps: 'number',
  frames: 'number',
  timeout: 'number',
  skip: 'number',
  dumpframe: 'string',
  read: 'boolean',
  revert: 'boolan',
  flip: 'string',
  crop: 'stirng',
  scale: 'number',
  rotate: 'number',
  deinterlace: 'boolean',
  invert: 'boolean',
  greyscale: 'boolean',
  swapchannels: 'string',
  // noBanner: 'boolean',
  // topBanner: 'boolean',
  // bottomBanner: 'boolean',
  bannerColour: 'string',
  lineColour: 'string',
  textColour: 'string',
  font: 'string',
  shadow: 'boolean',
  title: 'string',
  subtitle: 'string',
  timestamp: 'string',
  gmt: 'boolean',
  info: 'string',
  underlay: 'string',
  overlay: 'string'
}

function Camera(opts) {
  this.shots = [];
  this.opts = merge(Camera.DEFAULT_OPTS, opts || {});
}

Camera.capture = function (location, callback) {
  if (typeof location === 'function') {
    callback = location;
    location = null;
  }
  return new Camera().capture(location, callback);
};

Camera.listDevices = function (callback) {
  var reg = /^video/i;
  var dir = "/dev/";

  fs.readdir(dir, function (err, devfiles) {
    if (err) return callback(err);
    var cams = devfiles
      .filter(function (devfile) {
        return reg.test(devfile);
      })
      .map(function (devfile) {
        return dir + devfile;
      });

    callback(null, cams);
  });
};

Camera.hasCamera = function (callback) {
  Camera.listDevices(function (err, devices) {
    if (err) return callback(err);
    callback(null, devices.length > 0);
  });
}


/**
 * Global output types
 *
 * @property Camera.CALLBACK_RETURN_TYPES
 *
 * @type Object
 * @static
 *
 */
Camera.CALLBACK_RETURN_TYPES = {
  DEFAULT: 'location',
  LOCATION: 'location', // Shot location
  BUFFER: 'buffer', // Buffer object
  BASE64: 'base64' // String ex : "data..."
}

/**
 * Global output types
 * Various for platform
 *
 * @property Camera.OUTPUT_TYPES
 *
 * @type Object
 * @static
 *
 */
Camera.OUTPUT_TYPES = {
  jpeg: "jpg",
  png: "png"
};


//Validations const
Camera.VALIDATIONS = {
  noCamera: /no.*such.*(file|device)/i
};

Camera.prototype = {
  constructor: Camera,

  /**
   * Clone camera
   * 
   * @method clone
   */
  clone: function(opts) {
    return new Camera(merge(this.opts, opts));
  },

  /**
   * Get camera device
   * 
   * @method getDevice
   */
  getDevice: function() {
    return this.opts.device;
  },

  /**
   * Clear shot and camera memory data
   *
   * @method clear
   *
   */
  clear: function () {
    this.slots = [];
  },

  /**
   * Capture shot
   *
   * @method capture
   *
   * @param {String} location
   * @param {Function} callback
   * @return void
   *
   */
  capture: function (location, callback) {
    var scope = this;

    if (typeof location === 'function') {
      callback = location;
      location = null;
    }

    if (
      location === null
      && scope.opts.callbackReturn === Camera.CALLBACK_RETURN_TYPES.LOCATION
    ) {
      scope.opts.callbackReturn = "buffer";
    }

    var fileType = Camera.OUTPUT_TYPES[scope.opts.output];
    var location = location === null
      ? null
      : (location.match(/\..*$/)
        ? location
        : location + "." + fileType
      );


    //Shell statement grab
    var sh = scope.generateSh(location);

    if (scope.opts.verbose) {
      console.log(sh);
    }

    //Shell execute
    var shArgs = {
      maxBuffer: 1024 * 10000,
      encoding: 'buffer'
    };

    exec(sh, shArgs, function (err, out, derr) {
      if (err) {
        if (scope.opts.verbose && derr) {
          console.log(derr);
        }
        return callback(err);
      }

      //Run validation overrides
      var validationErrors;
      if (validationErrors = scope.runCaptureValidations(derr)) {
        return callback(validationErrors);
      }

      var shot = scope.createShot(location, out);
      if (scope.opts.saveShots) {
        scope.shots.push(shot);
      }

      scope.handleCallbackReturnType(shot, callback);
    });

  },

  /**
   * Generate cli command string
   *
   * @method generateSh
   *
   * @return {String}
   *
   */
  generateSh: function (location) {
    var scope = this;

    var banner = !scope.opts.topBanner && !scope.opts.bottomBanner
      ? "--no-banner"
      : (scope.opts.topBanner
        ? "--top-banner"
        : "--bottom-banner");
    
    var format = '--' + scope.opts.output + ' ' + scope.opts.quality

    var setValues = scope.getControlSetString(scope.opts.setValues);

    var opts2Strs = [];
    Object.keys(scope.opts).forEach(function(key) {
      var _key = formatOptionsKey(key);
      if (!OPTIONS[key]) return;
      if (OPTIONS[key] === 'boolean') {
        opts2Strs.push(_key);
      } else {
        opts2Strs.push(_key + ' ' + scope.opts[key]);
      }
    });

    // Use memory if null location
    var shellLocation = (location === null)
      ? '- -'
      : location;

    var sh = EXEC_BIN + ' -q '
      + format + ' '
      + banner + ' '
      + setValues + ' '
      + opts2Strs.join(' ') + ' '
      + shellLocation;

    return sh;
  },

  /**
   * Get control values string
   *
   * @param {Object} setValues
   *
   * @returns {String}
   *
   */
  getControlSetString: function (setValues) {
    var str = "";
    if (typeof (setValues) !== "object") {
      return str;
    }

    for (var setName in setValues) {
      var val = setValues[setName];
      if (!val) { continue; }
      str += setName + "=" + val;
    }
    return str
      ? "-s " + str
      : "";
  },

  createShot: function (location, data) {
    if (location === null) {
      var data = new Buffer(data);
    }
    return new Shot(location, data);
  },

  /**
   * Get shot instances from cache index
   *
   * @method getShot
   *
   * @param {Number} shot Index of shots called
   * @param {Function} callback Returns a call from FS.readFile data
   *
   * @throws Error if shot at index not found
   *
   * @return {Boolean}
   *
   */
  getShot: function (index, callback) {
    var scope = this;
    var shot = scope.shots[index | 0];
    if (!shot) {
      throw new Error(
        "Shot number " + index + " not found"
      );
      return;
    }
    return shot;
  },

  /**
   * Get last shot taken image data
   *
   * @method getLastShot
   *
   * @throws Error Camera has no last shot
   *
   * @return {Shot}
   *
   */
  getLastShot: function () {
    var scope = this;
    if (!scope.shots.length) {
      throw new Error("Camera has no last shot");
      return;
    }
    return scope.getShot(scope.shots.length - 1);
  },

  /**
   * Get shot buffer from location
   * 0 indexed
   *
   * @method getShotBuffer
   *
   * @param {Number} shot Index of shots called
   * @param {Function} callback Returns a call from fs.readFile data
   *
   * @return {Boolean}
   *
   */
  getShotBuffer: function (shot, callback) {
    var scope = this;
    if (typeof (shot) === "number") {
      shot = scope.getShot(shot);
    }
    if (shot.location) {
      fs.readFile(shot.location, function (err, data) {
        callback(err, data);
      });
    } else if (!shot.data) {
      callback(
        new Error("Shot not valid")
      );
    } else {
      callback(null, shot.data);
    }
  },


  /**
   * Get last shot buffer taken image data
   *
   * @method getLastShotBuffer
   *
   * @throws Error Shot not found
   *
   * @return {Shot}
   *
   */
  getLastShotBuffer: function (callback) {
    var scope = this;
    var shot = scope.getLastShot();
    scope.getShotBuffer(shot, callback);
  },

  /**
   * Get shot base64 as image
   * if passed Number will return a base 64 in the callback
   *
   * @method getBase64
   *
   * @param {Number|fs.readFile} shot To be converted
   * @param {Function( Error|null, Mixed )} callback Returns base64 string
   *
   * @return {String} Dont use
   *
   */

  getBase64: function (shot, callback) {
    var scope = this;
    scope.getShotBuffer(shot, function (err, data) {
      if (err) {
        callback(err);
        return;
      }
      var base64 = scope.getBase64FromBuffer(data);
      callback(null, base64);
    });
  },


  /**
   * Get base64 string from bufer
   *
   * @method getBase64
   *
   * @param {Number|fs.readFile} shot To be converted
   * @param {Function( Error|null, Mixed )} callback Returns base64 string
   *
   * @return {String} Dont use
   *
   */
  getBase64FromBuffer: function (shotBuffer) {
    var scope = this;
    var image = "data:image/"
      + scope.opts.output
      + ";base64,"
      + new Buffer(shotBuffer).toString("base64");
    return image;
  },


  /**
   * Get last shot taken base 64 string
   *
   * @method getLastShot64
   *
   * @param {Function} callback
   *
   */
  getLastShot64: function (callback) {
    var scope = this;
    if (!scope.shots.length) {
      callback && callback(new Error("Camera has no last shot"));
    }
    scope.getBase64(scope.shots.length - 1, callback);
  },


  /**
   * Get last shot taken image data
   *
   * @method handleCallbackReturnType
   *
   * @param {String} shot
   * @param {Function} callback
   *
   * @throws Error callbackReturn Type not valid
   *
   */
  handleCallbackReturnType: function (shot, callback) {
    var scope = this;
    switch (scope.opts.callbackReturn) {
      case Camera.CALLBACK_RETURN_TYPES.LOCATION:
        return callback(null, shot.location);

      case Camera.CALLBACK_RETURN_TYPES.BUFFER:
        return scope.getShotBuffer(shot, callback);

      case Camera.CALLBACK_RETURN_TYPES.BASE64:
        return scope.getBase64(shot, callback);

      default:
        return callback(
          new Error(
            "Callback return type not valid " + scope.opts.callbackReturn
          )
        );
    }
  },

  /**
   * Data validations based on fs output
   *
   * @inheritdoc
   *
   */
  runCaptureValidations: function (data) {
    if (Camera.VALIDATIONS.noCamera.test(data)) {
      return new Error("No webcam found");
    }
    return null;
  }
}

/**
 * Base defaults for option construction
 *
 * @property Camera.DEFAULT_OPTS
 *
 * @type Object
 * @static
 *
 */

Camera.DEFAULT_OPTS = {
  //Save shots in memory
  saveShots: false,

  quality: -1,
  // [jpeg, png] support varies
  // Camera.OutputTypes
  output: "jpeg",

  // [location, buffer, base64]
  // Camera.CALLBACK_RETURN_TYPES
  callbackReturn: "location",

  setValues: {},

  //Logging
  verbose: false
};



/**
 * Shot struct
 *
 * @class Shot
 * @constructor
 * @param {String|null} location
 * @param {Buffer|null} data
 *
 */
function Shot(location, data) {
  var scope = this;
  scope.location = location;
  scope.data = data;
};

function formatOptionsKey(key) {
  var result = '--';
  key.split('').forEach(function(c) {
    var cc = c.charCodeAt(0);
    if (cc > 64 && cc < 97) {
      result += '-' + c.toLowerCase();
    } else {
      result += c;
    }
  });
  return result;
}

module.exports = Camera;