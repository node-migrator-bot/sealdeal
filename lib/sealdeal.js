(function() {
  var build, compileCSSFile, compileFile, compileHTMLFile, compileJSDir, compileJSFile, concatCSSDir, concatFiles, concatJSDir, copyTree, cssExtensions, cssFilter, extensionRegex, extractJSRequires, extractRequires, fileConfig, fileType, fs, getCompiler, getFiles, htmlExtensions, htmlFilter, isInsideDir, itemToLast, jsExtensions, jsFilter, path, readFile, readHTMLPage, regexFilter, removeExt, requireCompiler, walk, writeFileRecursive, _;

  fs = require('fs');

  path = require('path');

  _ = require('underscore');

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
    'less': function(txt) {},
    'styl': requireCompiler('stylus', function(txt, compiler) {
      var css;
      css = '';
      compiler.render(txt, function(err, out) {
        return css = out;
      });
      return css;
    })
  };

  htmlExtensions = {
    'jade': requireCompiler('jade', function(txt, compiler) {
      return compiler.compile(txt);
    }),
    'ck': function(txt) {}
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

  compileFile = function(filename, extensions) {
    var compile, compiler, txt;
    compiler = getCompiler(filename);
    compile = extensions[compiler];
    txt = fs.readFileSync(filename, 'utf8');
    if (compile != null) {
      return compile(txt);
    } else {
      return txt;
    }
  };

  compileHTMLFile = function(filename) {
    return compileFile(filename, htmlExtensions);
  };

  compileJSFile = function(filename) {
    return compileFile(filename, jsExtensions);
  };

  compileCSSFile = function(filename) {
    return compileFile(filename, cssExtensions);
  };

  readHTMLPage = function(args) {
    var content, context, template, templateFile, templateFileBasename, templateFiles, templateKey, templateNamespace, templates, templatesDir, _i, _len;
    if (args.filename === args.layout) {
      return false;
    }
    content = compileHTMLFile(args.filename);
    if (args.layout != null) {
      context = args.layoutLocals || {};
      context.content = content(args.pageLocals || {});
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
      return compileHTMLFile(args.layout)(context);
    } else {
      return content;
    }
  };

  readFile = function(filename, config) {
    var args, dirFile, directory, files, wholeFilename, _i, _len;
    args = fileConfig(filename, config);
    directory = path.dirname(filename);
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
    var relativeFilename, title, _ref, _ref1;
    relativeFilename = path.relative(config.src, filename);
    title = ((_ref = config.pages) != null ? (_ref1 = _ref[relativeFilename]) != null ? _ref1.title : void 0 : void 0) || config.title;
    return {
      filename: filename,
      layout: path.join(config.src, config.layout),
      templates: 'src/templates',
      templateNamespace: config.templateNamespace || 'APP_TEMPLATES',
      title: title
    };
  };

  removeExt = function(filename, ext) {
    var newFilename, _ref;
    newFilename = (_ref = /([a-z]*\.[a-z]*)(\.[a-z]*)?$/i.exec(filename)) != null ? _ref[1] : void 0;
    if (newFilename != null) {
      return newFilename;
    } else {
      return false;
    }
  };

  itemToLast = function(array, item) {
    return _.without(array, item).push(item);
  };

  extractRequires = (function() {
    var regexes;
    regexes = {};
    return function(txt, commentDelimiter) {
      var requireRegexp, requiredFiles, _ref;
      requireRegexp = regexes[commentDelimiter];
      if (requireRegexp == null) {
        requireRegexp = new RegExp("^" + commentDelimiter + "\= require ['\"]([^'\"]*)['\"]$", 'gim');
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

  extractJSRequires = function(txt) {
    return extractRequires(txt, '//');
  };

  concatFiles = function(files, compile, requireFunc) {
    var compiled, file, fileTxt, requires, txt;
    txt = '';
    compiled = {};
    while (files.length > 0) {
      file = files[0];
      fileTxt = compiled[file];
      if (fileTxt == null) {
        fileTxt = compile(file);
        compiled[file] = fileTxt;
      }
      requires = requireFunc(fileTxt);
      if (_.intersection(files, requires).length) {
        itemToLast(files, file);
      } else {
        delete compiled[file];
        files = _.without(files, file);
        txt += fileTxt;
      }
    }
    return txt;
  };

  concatJSDir = function(dir, minify) {
    var files;
    files = jsFilter(getFiles(dir));
    return concatFiles(files, compileJSFile, extractJSRequires);
  };

  concatCSSDir = function(dir, minify) {
    var files;
    files = cssFilter(getFiles(dir));
    return concatFiles(files, compileCSSFile, function() {
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

  writeFileRecursive = function(filename, data) {
    var mkdir;
    mkdir = function(dirname) {
      if (!path.existsSync(dirname)) {
        mkdir(path.dirname(dirname));
        return fs.mkdirSync(dirname);
      }
    };
    mkdir(path.dirname(filename));
    return fs.writeFileSync(filename, data);
  };

  copyTree = function(fromPath, toPath) {
    var data, filename, files, targetFilename, _i, _len, _results;
    files = getFiles(fromPath);
    _results = [];
    for (_i = 0, _len = files.length; _i < _len; _i++) {
      filename = files[_i];
      targetFilename = path.join(toPath, path.relative(fromPath, filename));
      console.log(filename, targetFilename);
      data = fs.readFileSync(filename);
      _results.push(writeFileRecursive(targetFilename, data));
    }
    return _results;
  };

  compileJSDir = function(dir, target) {
    var file, filename, js, _i, _len, _ref, _results;
    _ref = jsFilter(getFiles(dir));
    _results = [];
    for (_i = 0, _len = _ref.length; _i < _len; _i++) {
      file = _ref[_i];
      js = compileJSFile(file);
      filename = path.join(target, path.basename(removeExt(file)));
      _results.push(writeFileRecursive(filename, js));
    }
    return _results;
  };

  build = function(config) {
    var concatCSS, concatJS, concatToTarget, cssDirsPath, data, fileDir, filename, files, jsDirsPath, layoutPath, relativeFilename, src, target, targetFilename, templatePath, _i, _len;
    src = config.src, concatJS = config.concatJS, concatCSS = config.concatCSS;
    target = config.build;
    files = getFiles(src);
    layoutPath = path.join(src, config.layout);
    concatToTarget = function(dir, filename, func) {
      var txt;
      txt = func(dir, true);
      return writeFileRecursive(path.join(target, filename), txt);
    };
    jsDirsPath = concatJS ? path.join(src, concatJS) : null;
    cssDirsPath = concatCSS ? path.join(src, concatCSS) : null;
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
        targetFilename = path.join(target, path.join(path.dirname(relativeFilename), removeExt(relativeFilename)));
        writeFileRecursive(targetFilename, data);
      }
    }
    if (concatJS != null) {
      concatToTarget(jsDirsPath, 'js/app.js', concatJSDir);
    }
    if (concatCSS != null) {
      return concatToTarget(cssDirsPath, 'css/app.css', concatCSSDir);
    }
  };

  module.exports.getFiles = getFiles;

  module.exports.fileType = fileType;

  module.exports.concatJSDir = concatJSDir;

  module.exports.concatCSSDir = concatCSSDir;

  module.exports.compileJSDir = compileJSDir;

  module.exports.compileJSFile = compileJSFile;

  module.exports.compileHTMLFile = compileHTMLFile;

  module.exports.removeExt = removeExt;

  module.exports.readHTMLPage = readHTMLPage;

  module.exports.readFile = readFile;

  module.exports.writeFileRecursive = writeFileRecursive;

  module.exports.copyTree = copyTree;

  module.exports.build = build;

}).call(this);
