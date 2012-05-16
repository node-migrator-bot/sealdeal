(function() {
  var express, fs, path, sealdeal;

  express = require('express');

  fs = require('fs');

  path = require('path');

  sealdeal = require('./sealdeal');

  module.exports = {
    run: function(config) {
      var app, appPath, cwd, preprocessor;
      cwd = process.cwd();
      app = express.createServer();
      app.configure(function() {
        app.use(express.bodyParser());
        app.use(express.methodOverride());
        return app.use(app.router);
      });
      app.configure(function() {
        return app.use(express["static"](path.join(cwd, config.src)));
      });
      app.configure('development', function() {
        return app.use(express.errorHandler({
          dumpExceptions: true,
          showStack: true
        }));
      });
      app.configure('production', function() {
        return app.use(express.errorHandler());
      });
      appPath = path.join(cwd, config.src);
      app.get('/js/app.js', function(req, res) {
        res.contentType('application/javascript');
        return res.send(sealdeal.concatJSDir(path.join(appPath, 'js/app')));
      });
      app.get('/css/app.css', function(req, res) {
        res.contentType('text/css');
        return res.send(sealdeal.concatCSSDir(path.join(appPath, 'css/app')));
      });
      preprocessor = function(req, res, next) {
        var filePath, filename, layout, title, _ref, _ref1;
        layout = path.join(appPath, config.layout);
        filename = req.params[0];
        filePath = path.join(appPath, filename);
        title = ((_ref = config.pages) != null ? (_ref1 = _ref[filename]) != null ? _ref1.title : void 0 : void 0) || config.title;
        return fs.stat(filePath, function(err, fileStats) {
          var fileType, txt;
          if (fileStats && fileStats.isDirectory()) {
            return next();
          } else {
            txt = sealdeal.readFile(filePath, config);
            if (txt) {
              fileType = sealdeal.fileType(filePath);
              switch (fileType) {
                case 'js':
                  res.contentType('application/javascript');
                  break;
                case 'css':
                  res.contentType('text/css');
                  break;
                case 'html':
                  res.contentType('text/html');
              }
              return res.send(txt);
            } else {
              return next();
            }
          }
        });
      };
      app.get('/*', preprocessor);
      app.get('/', function(req, res, next) {
        req.params[0] = "/index.html";
        return preprocessor(req, res, next);
      });
      app.listen(3000);
      return console.log("Express server listening on port %d in %s mode", app.address().port, app.settings.env);
    }
  };

}).call(this);
