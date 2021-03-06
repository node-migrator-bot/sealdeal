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
      app.get('/js/app.js', sealdeal.jsRoute(path.join(appPath, config.concatJS)));
      preprocessor = sealdeal.preprocessorRoute(appPath, config);
      app.get('/*', preprocessor);
      app.get('/', function(req, res, next) {
        req.params[0] = "/index.html";
        return preprocessor(req, res, next);
      });
      sealdeal.addProxyRoutes(app, config.proxies);
      app.listen(config.port || 3000);
      return console.log("Express server listening on port %d in %s mode", app.address().port, app.settings.env);
    }
  };

}).call(this);
