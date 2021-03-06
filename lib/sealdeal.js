(function() {
  var addProxyRoutes, build, commentDelimiters, compileCSS, compileCSSFile, compileCoffeeFileTo, compileFile, compileHTML, compileHTMLFile, compileJS, compileJSDir, compileJSFile, compileText, concatCSSDir, concatFiles, concatJSDir, copyTree, cssExtensions, cssFilter, cssRoute, extensionRegex, extractJSRequires, extractRequires, fileConfig, fileType, fs, getCompiler, getFiles, getFilesAsync, htmlExtensions, htmlFilter, http, isInsideDir, itemToLast, jsExtensions, jsFilter, jsRoute, mkdirRecursive, nib, path, preprocessorRoute, readFile, readHTMLPage, regexFilter, removeExt, requireCompiler, stylus, url, walk, withoutItem, writeFileRecursive,
    __indexOf = [].indexOf || function(item) { for (var i = 0, l = this.length; i < l; i++) { if (i in this && this[i] === item) return i; } return -1; },
    __hasProp = {}.hasOwnProperty;

  fs = require('fs');

  path = require('path');

  url = require('url');

  http = require('http');

  stylus = require('stylus');

  nib = require('nib');

  requireCompiler = function(name, callback) {
    var compiler;
    if (callback == null) {
      callback = function(txt, compiler) {
        return compiler.compile(txt);
      };
    }
    compiler = null;
    return function(txt) {
      if (compiler == null) {
        compiler = require(name);
      }
      return callback(txt, compiler);
    };
  };

  jsExtensions = {
    'coffee': requireCompiler('coffee-script')
  };

  cssExtensions = {
    'less': function(txt, filename) {},
    'styl': function(txt, filename) {
      var css;
      css = '';
      stylus(txt).set('filename', filename).use(nib())["import"]('nib').render(function(err, out) {
        return css = out;
      });
      return css;
    }
  };

  htmlExtensions = {
    'jade': requireCompiler('jade', function(txt, compiler) {
      return compiler.compile(txt);
    }),
    'ck': function(txt) {}
  };

  getFilesAsync = function(dir, callback) {
    var walkAsync;
    return walkAsync = function(dir) {
      return fs.readdir(dir, function(err, data) {});
    };
  };

  walk = function(dir, callback) {
    var dirs, filePath, filename, filenames, files, _i, _len;
    filenames = fs.readdirSync(dir);
    files = [];
    dirs = [];
    for (_i = 0, _len = filenames.length; _i < _len; _i++) {
      filename = filenames[_i];
      filePath = path.join(dir, filename);
      if (fs.statSync(filePath).isDirectory() && (filename !== '.' && filename !== '..')) {
        dirs.push(filename);
        walk(filePath, callback);
      } else {
        files.push(filename);
      }
    }
    return callback(dir, dirs, files);
  };

  getFiles = function(dir) {
    var paths;
    paths = [];
    walk(dir, function(dir, dirs, files) {
      var file, _i, _len, _results;
      _results = [];
      for (_i = 0, _len = files.length; _i < _len; _i++) {
        file = files[_i];
        _results.push(paths.push(path.join(dir, file)));
      }
      return _results;
    });
    return paths;
  };

  regexFilter = function(array, regex) {
    var item, _i, _len, _results;
    _results = [];
    for (_i = 0, _len = array.length; _i < _len; _i++) {
      item = array[_i];
      if (regex.test(item)) {
        _results.push(item);
      }
    }
    return _results;
  };

  extensionRegex = function(extension) {
    return new RegExp("\." + extension + "(\.[a-z]*)?$", 'i');
  };

  getCompiler = function(filename) {
    var compiler, _ref;
    compiler = (_ref = /\.[a-z]*\.([a-z]*)$/i.exec(filename)) != null ? _ref[1] : void 0;
    if (compiler != null) {
      return compiler;
    } else {
      return false;
    }
  };

  jsFilter = function(array) {
    return regexFilter(array, extensionRegex('js'));
  };

  cssFilter = function(array) {
    return regexFilter(array, extensionRegex('css'));
  };

  htmlFilter = function(array) {
    return regexFilter(array, extensionRegex('html'));
  };

  fileType = function(filename) {
    var testFileType;
    testFileType = function(filter) {
      return filter([filename]).length > 0;
    };
    if (testFileType(jsFilter)) {
      return 'js';
    } else if (testFileType(cssFilter)) {
      return 'css';
    } else if (testFileType(htmlFilter)) {
      return 'html';
    } else {
      return false;
    }
  };

  compileText = function(txt, filename, extensions) {
    var compile, compiler;
    compiler = getCompiler(filename);
    compile = extensions[compiler];
    if (compile != null) {
      return compile(txt, filename);
    } else {
      return txt;
    }
  };

  compileFile = function(filename, extensions) {
    var txt;
    txt = fs.readFileSync(filename, 'utf8');
    return compileText(txt, filename, extensions);
  };

  compileHTML = function(txt, filename) {
    return compileText(txt, filename, htmlExtensions);
  };

  compileHTMLFile = function(filename) {
    return compileFile(filename, htmlExtensions);
  };

  compileJS = function(txt, filename) {
    return compileText(txt, filename, jsExtensions);
  };

  compileJSFile = function(filename) {
    return compileFile(filename, jsExtensions);
  };

  compileCSS = function(txt, filename) {
    return compileText(txt, filename, cssExtensions);
  };

  compileCSSFile = function(filename) {
    return compileFile(filename, cssExtensions);
  };

  readHTMLPage = function(args) {
    var content, context, renderMain;
    if (args.filename === args.layout) {
      return false;
    }
    renderMain = function(context) {
      var template, templateFile, templateFileBasename, templateFiles, templateKey, templateNamespace, templates, templatesDir, _i, _len;
      if (context.title == null) {
        context.title = args.title || '';
      }
      templatesDir = args.templates;
      templateNamespace = args.templateNamespace;
      if ((templatesDir != null) && (templateNamespace != null)) {
        templateFiles = getFiles(templatesDir);
        templates = {};
        for (_i = 0, _len = templateFiles.length; _i < _len; _i++) {
          templateFile = templateFiles[_i];
          template = fs.readFileSync(templateFile, 'utf8');
          templateFileBasename = path.basename(templateFile);
          templateKey = templateFileBasename.slice(0, templateFileBasename.indexOf('.'));
          templates[templateKey] = template;
        }
        context.templates = JSON.stringify(templates);
        context.templateNamespace = templateNamespace;
      }
      return context;
    };
    content = compileHTMLFile(args.filename);
    if (args.layout != null) {
      context = args.layoutLocals || {};
      context.content = content(args.pageLocals || {});
      context = renderMain(context);
      return compileHTMLFile(args.layout)(context);
    } else {
      context = renderMain(args.pageLocals || {});
      return content(context);
    }
  };

  readFile = function(filename, config) {
    var args, dirFile, directory, files, wholeFilename, _i, _len;
    args = fileConfig(filename, config);
    directory = path.dirname(filename);
    if (!path.existsSync(directory)) {
      return false;
    }
    files = fs.readdirSync(directory);
    for (_i = 0, _len = files.length; _i < _len; _i++) {
      dirFile = files[_i];
      if (dirFile.indexOf(path.basename(filename)) === 0) {
        wholeFilename = path.join(directory, dirFile);
        args.filename = wholeFilename;
        switch (fileType(dirFile)) {
          case 'js':
            return compileJSFile(wholeFilename);
          case 'css':
            return compileCSSFile(wholeFilename);
          case 'html':
            return readHTMLPage(args);
          default:
            return false;
        }
      }
    }
    return false;
  };

  fileConfig = function(filename, config) {
    var pageLocals, relativeFilename, title, _ref, _ref1, _ref2, _ref3;
    relativeFilename = path.relative(config.src, filename);
    title = ((_ref = config.pages) != null ? (_ref1 = _ref[relativeFilename]) != null ? _ref1.title : void 0 : void 0) || config.title;
    pageLocals = ((_ref2 = config.pages) != null ? (_ref3 = _ref2[relativeFilename]) != null ? _ref3.pageLocals : void 0 : void 0) || config.pageLocals;
    return {
      filename: filename,
      layout: config.layout ? path.join(config.src, config.layout) : null,
      templates: config.templates,
      templateNamespace: config.templateNamespace || 'APP_TEMPLATES',
      title: title,
      pageLocals: pageLocals
    };
  };

  removeExt = function(filename, ext) {
    var newFilename, _ref;
    newFilename = (_ref = /([a-z_\-0-9]*\.[a-z_\-0-9]*)(\.[a-z_\-0-9]*)?$/i.exec(filename)) != null ? _ref[1] : void 0;
    if (newFilename != null) {
      return newFilename;
    } else {
      return false;
    }
  };

  withoutItem = function(array, excluded) {
    var item, _i, _len, _results;
    _results = [];
    for (_i = 0, _len = array.length; _i < _len; _i++) {
      item = array[_i];
      if (item !== excluded) {
        _results.push(item);
      }
    }
    return _results;
  };

  itemToLast = function(array, item) {
    return withoutItem(array, item).concat([item]);
  };

  commentDelimiters = {
    js: '//',
    coffee: '#'
  };

  extractRequires = (function() {
    var regexes;
    regexes = {};
    return function(txt, commentDelimiter) {
      var requireRegexp, requiredFiles, _ref;
      requireRegexp = regexes[commentDelimiter];
      if (requireRegexp == null) {
        requireRegexp = new RegExp("^\\s*" + commentDelimiter + "\= require ['\"]([^'\"]*)['\"]$", 'gim');
        regexes[commentDelimiter] = requireRegexp;
      }
      requiredFiles = (_ref = requireRegexp.exec(txt)) != null ? _ref.slice(1) : void 0;
      if (requiredFiles != null) {
        return requiredFiles;
      } else {
        return [];
      }
    };
  })();

  extractJSRequires = function(txt, filename) {
    var compiler;
    compiler = getCompiler(filename);
    if (compiler) {
      return extractRequires(txt, commentDelimiters[compiler]);
    } else {
      return extractRequires(txt, commentDelimiters.js);
    }
  };

  concatFiles = function(files, compile, requireFunc, root) {
    var file, fileTxt, filesRead, requires, txt;
    txt = '';
    filesRead = {};
    while (files.length > 0) {
      file = files[0];
      fileTxt = filesRead[file];
      if (fileTxt == null) {
        fileTxt = fs.readFileSync(file, 'utf8');
        filesRead[file] = fileTxt;
      }
      requires = requireFunc(fileTxt, file);
      if ((function() {
        var filename, _i, _len, _ref;
        for (_i = 0, _len = files.length; _i < _len; _i++) {
          filename = files[_i];
          if (_ref = removeExt(path.relative(root, filename)), __indexOf.call(requires, _ref) >= 0) {
            return true;
          }
        }
        return false;
      })()) {
        files = itemToLast(files, file);
      } else {
        delete filesRead[file];
        files = withoutItem(files, file);
        txt += compile(fileTxt, file);
      }
    }
    return txt;
  };

  concatJSDir = function(dir, minify) {
    var files;
    files = jsFilter(getFiles(dir));
    return concatFiles(files, compileJS, extractJSRequires, dir);
  };

  concatCSSDir = function(dir, minify) {
    var files;
    files = cssFilter(getFiles(dir));
    return concatFiles(files, compileCSS, function() {
      return [];
    });
  };

  isInsideDir = function(dir, containingDir) {
    if (!((dir != null) && (containingDir != null))) {
      return false;
    }
    if (dir.slice(-1) !== '/') {
      dir += '/';
    }
    if (containingDir.slice(-1) !== '/') {
      containingDir += '/';
    }
    return dir.indexOf(containingDir) === 0;
  };

  mkdirRecursive = function(dirname) {
    if (!path.existsSync(dirname)) {
      mkdirRecursive(path.dirname(dirname));
      return fs.mkdirSync(dirname);
    }
  };

  writeFileRecursive = function(filename, data, encoding) {
    mkdirRecursive(path.dirname(filename));
    return fs.writeFileSync(filename, data, encoding);
  };

  copyTree = function(fromPath, toPath) {
    var data, filename, files, targetFilename, _i, _len, _results;
    files = getFiles(fromPath);
    _results = [];
    for (_i = 0, _len = files.length; _i < _len; _i++) {
      filename = files[_i];
      targetFilename = path.join(toPath, path.relative(fromPath, filename));
      data = fs.readFileSync(filename);
      _results.push(writeFileRecursive(targetFilename, data));
    }
    return _results;
  };

  compileCoffeeFileTo = function(file, target, modify) {
    var js;
    if (modify == null) {
      modify = function(n) {
        return n;
      };
    }
    js = jsExtensions['coffee'](fs.readFileSync(file, 'utf8'));
    return writeFileRecursive(target, modify(js), 'utf8');
  };

  compileJSDir = function(dir, target) {
    var file, filename, js, _i, _len, _ref, _results;
    _ref = jsFilter(getFiles(dir));
    _results = [];
    for (_i = 0, _len = _ref.length; _i < _len; _i++) {
      file = _ref[_i];
      js = compileJSFile(file);
      filename = path.join(target, path.basename(removeExt(file)));
      _results.push(writeFileRecursive(filename, js, 'utf8'));
    }
    return _results;
  };

  build = function(config) {
    var basename, concatToTarget, cssDirs, cssDirsPath, data, fileDir, filename, files, jsDirs, jsDirsPath, layoutPath, relativeFilename, src, target, targetFilename, templatePath, _i, _len;
    src = config.src;
    jsDirs = config.concatJS;
    cssDirs = config.concatCSS;
    target = config.build;
    if (target && fs.statSync(target).isDirectory()) {
      fs.rmdir(target);
    } else if (!target) {
      return;
    }
    files = getFiles(src);
    layoutPath = path.join(src, config.layout);
    concatToTarget = function(dir, filename, func) {
      var txt;
      txt = func(dir, true);
      return writeFileRecursive(path.join(target, filename), txt);
    };
    jsDirsPath = jsDirs ? path.join(src, jsDirs) : null;
    cssDirsPath = cssDirs ? path.join(src, cssDirs) : null;
    templatePath = path.join(src, config.templates);
    for (_i = 0, _len = files.length; _i < _len; _i++) {
      filename = files[_i];
      fileDir = path.dirname(filename);
      if (filename === layoutPath || isInsideDir(fileDir, jsDirsPath) || isInsideDir(fileDir, cssDirsPath) || isInsideDir(fileDir, templatePath)) {
        continue;
      } else {
        data = readFile(filename, config);
        if (!data) {
          data = fs.readFileSync(filename);
        }
        relativeFilename = path.relative(src, filename);
        basename = removeExt(relativeFilename) || relativeFilename;
        targetFilename = path.join(target, path.join(path.dirname(relativeFilename), basename));
        writeFileRecursive(targetFilename, data);
      }
    }
    if (jsDirs != null) {
      concatToTarget(jsDirsPath, 'js/app.js', concatJSDir);
    }
    if (cssDirs != null) {
      return concatToTarget(cssDirsPath, 'css/app.css', concatCSSDir);
    }
  };

  jsRoute = function(jsPath) {
    return function(req, res) {
      res.contentType('application/javascript; charset=utf-8');
      return res.send(concatJSDir(jsPath));
    };
  };

  cssRoute = function(cssPath) {
    return function(req, res) {
      res.contentType('text/css');
      return res.send(concatCSSDir(cssPath));
    };
  };

  preprocessorRoute = function(appPath, config) {
    return function(req, res, next) {
      var filePath, filename, title, _ref, _ref1;
      filename = req.params[0];
      filePath = path.join(appPath, filename);
      title = ((_ref = config.pages) != null ? (_ref1 = _ref[filename]) != null ? _ref1.title : void 0 : void 0) || config.title;
      return fs.stat(filePath, function(err, fileStats) {
        var ft, txt;
        if (fileStats && fileStats.isDirectory()) {
          return next();
        } else {
          txt = readFile(filePath, config);
          if (txt) {
            ft = fileType(filePath);
            switch (ft) {
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
  };

  addProxyRoutes = function(app, routesHash) {
    var proxyConfig, route, _results;
    _results = [];
    for (route in routesHash) {
      if (!__hasProp.call(routesHash, route)) continue;
      proxyConfig = routesHash[route];
      _results.push((function(route) {
        return app.all(path.join(route, '*'), function(req, res) {
          var proxyReq, proxyReqConfig;
          url = path.relative(route, req.url);
          proxyReqConfig = {
            hostname: proxyConfig.hostname || 'localhost',
            port: proxyConfig.port || 8080,
            method: req.method,
            path: path.join(proxyConfig.path || '/', url),
            headers: req.headers,
            auth: req.auth
          };
          proxyReq = http.request(proxyReqConfig, function(proxyRes) {
            var data;
            data = '';
            proxyRes.on('data', function(resData) {
              return data += resData;
            });
            return proxyRes.on('end', function() {
              var header, value, _i, _len, _ref;
              _ref = proxyRes.headers;
              for (value = _i = 0, _len = _ref.length; _i < _len; value = ++_i) {
                header = _ref[value];
                res.header(header, value);
              }
              res.contentType(proxyRes.header('content-type'));
              return res.send(data);
            });
          });
          if (req.method !== 'GET') {
            proxyReq.write(JSON.stringify(req.body));
          }
          return proxyReq.end();
        });
      })(route));
    }
    return _results;
  };

  module.exports.getFiles = getFiles;

  module.exports.fileType = fileType;

  module.exports.concatJSDir = concatJSDir;

  module.exports.concatCSSDir = concatCSSDir;

  module.exports.compileJSDir = compileJSDir;

  module.exports.compileJSFile = compileJSFile;

  module.exports.compileCoffeeFileTo = compileCoffeeFileTo;

  module.exports.compileHTMLFile = compileHTMLFile;

  module.exports.removeExt = removeExt;

  module.exports.readHTMLPage = readHTMLPage;

  module.exports.readFile = readFile;

  module.exports.writeFileRecursive = writeFileRecursive;

  module.exports.copyTree = copyTree;

  module.exports.build = build;

  module.exports.jsRoute = jsRoute;

  module.exports.cssRoute = cssRoute;

  module.exports.preprocessorRoute = preprocessorRoute;

  module.exports.addProxyRoutes = addProxyRoutes;

}).call(this);
