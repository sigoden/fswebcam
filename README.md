# [node-webcam](https://github.com/sigoden/fswebcamera)

manupulate uvc cameras on linux (mounted on /dev/video*), powerd by [fswebcam](https://github.com/fsphil/fswebcam).

# Install

### Linux

```
#Linux relies on fswebcam currently
#Tested on ubuntu

sudo apt-get install fswebcam
```

# Usage

### API Usage

``` javascript
//Available in nodejs
var Camera = require( "@sigodenh/fswebcam" );

//Return type with base 64 image
var opts = {
    callbackReturn: "base64"
};
Camera.capture( "test_picture", opts, function(err, data) {
    var image = "<img src='" + data + "'>";
});


//Get list of cameras
Camera.listDevices( function(err, devices) {
    var anotherCam = new Camera({ device: devices[0] });
});

//Creates webcam instance
var camera = new Camera(opts);

//Will automatically append location output type
camera.capture( "test_picture", function(err, data) {});
```