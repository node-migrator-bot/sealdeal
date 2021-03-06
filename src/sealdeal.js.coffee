fs        = require 'fs'
path      = require 'path'
url       = require 'url'
http      = require 'http'

stylus    = require 'stylus'
nib       = require 'nib'

requireCompiler = (name, callback = (txt, compiler) ->
  compiler.compile txt
) ->
  compiler = null
  (txt) ->
    unless compiler?
      compiler = require name
    callback(txt, compiler)

jsExtensions = {
  'coffee': requireCompiler 'coffee-script'
}

cssExtensions = {
  'less': (txt, filename) ->
  'styl': (txt, filename) ->
    css = ''
    stylus(txt).set('filename', filename).use(nib()).import('nib').render (err, out) -> css = out
    return css
}

htmlExtensions = {
  'jade': requireCompiler 'jade', (txt, compiler) ->
    compiler.compile txt
  'ck': (txt) ->
}

getFilesAsync = (dir, callback) ->
  walkAsync = (dir) ->
    fs.readdir dir, (err, data) ->

walk = (dir, callback) ->
  filenames = fs.readdirSync dir

  files = []
  dirs  = []

  for filename in filenames
    filePath = path.join dir, filename
    if fs.statSync(filePath).isDirectory() and (
      filename isnt '.' and filename isnt '..')
      dirs.push filename
      walk filePath, callback
    else
      files.push filename

  callback dir, dirs, files

getFiles = (dir) ->
  paths = []
  walk dir, (dir, dirs, files) ->
    for file in files
      paths.push path.join(dir, file)

  return paths

regexFilter = (array, regex) ->
  item for item in array when regex.test(item)

# pass in extension as js NOT .js
extensionRegex = (extension) ->
  # .extension followed by either the end of the string or
  # another file extension
  new RegExp "\.#{extension}(\.[a-z]*)?$", 'i'

getCompiler = (filename) ->
  compiler = (/\.[a-z]*\.([a-z]*)$/i).exec(filename)?[1]
  if compiler? then compiler else false

jsFilter = (array) ->
  regexFilter array, extensionRegex('js')

cssFilter = (array) ->
  regexFilter array, extensionRegex('css')

htmlFilter = (array) ->
  regexFilter array, extensionRegex('html')

fileType = (filename) ->
  testFileType = (filter) ->
    filter([filename]).length > 0

  if testFileType jsFilter
    return 'js'
  else if testFileType cssFilter
    return 'css'
  else if testFileType htmlFilter
    return 'html'
  else false

compileText = (txt, filename, extensions) ->
  compiler = getCompiler filename
  compile = extensions[compiler]
  if compile? then compile(txt, filename) else txt

compileFile = (filename, extensions) ->
  txt = fs.readFileSync filename, 'utf8'
  compileText txt, filename, extensions

compileHTML = (txt, filename) ->
  compileText txt, filename, htmlExtensions

compileHTMLFile = (filename) ->
  compileFile filename, htmlExtensions

compileJS = (txt, filename) ->
  compileText txt, filename, jsExtensions

compileJSFile = (filename) ->
  compileFile filename, jsExtensions

compileCSS = (txt, filename) ->
  compileText txt, filename, cssExtensions

compileCSSFile = (filename) ->
  compileFile filename, cssExtensions

#
# args =
#   filename:  Path to a file you want read and preprocessed
#   layout:    Path to a layout file for rendering html pages
#   templates: Path to a directory with templates to be
#     served on to front end.
#   pageLocals: This object will be fed to the template function
#     for the page you are requesting.
#   layoutLocals: This object will be passed to the template function
#     for your layout.
#
readHTMLPage = (args) ->
  if args.filename is args.layout
    return false

  renderMain = (context) ->
    context.title ?= args.title or ''
    templatesDir = args.templates
    templateNamespace = args.templateNamespace

    if templatesDir? and templateNamespace?
      templateFiles = getFiles templatesDir
      templates = {}
      for templateFile in templateFiles
        template = fs.readFileSync(templateFile, 'utf8')
        templateFileBasename = path.basename templateFile
        templateKey = templateFileBasename.slice 0, templateFileBasename.indexOf('.')
        templates[templateKey] = template

      context.templates         = JSON.stringify templates
      context.templateNamespace = templateNamespace

    return context

  content = compileHTMLFile args.filename
  if args.layout?
    context = args.layoutLocals or {}
    context.content = content args.pageLocals or {}
    context = renderMain context
    compileHTMLFile(args.layout) context

  else
    context = renderMain(args.pageLocals or {})
    content context

readFile = (filename, config) ->
  args = fileConfig filename, config

  directory = path.dirname filename
  return false unless path.existsSync directory
  files = fs.readdirSync directory
  for dirFile in files
    if dirFile.indexOf(path.basename filename) is 0
      wholeFilename = path.join directory, dirFile
      args.filename = wholeFilename

      return switch fileType dirFile
        when 'js'   then compileJSFile   wholeFilename
        when 'css'  then compileCSSFile  wholeFilename
        when 'html' then readHTMLPage args
        else false

  return false

# FIXME: This function exists because I was too lazy to do some refactoring
fileConfig = (filename, config) ->
  relativeFilename = path.relative config.src, filename
  title = config.pages?[relativeFilename]?.title or config.title
  pageLocals = config.pages?[relativeFilename]?.pageLocals or config.pageLocals

  filename: filename
  layout: if config.layout then path.join(config.src, config.layout) else null
  templates: config.templates
  templateNamespace: config.templateNamespace or 'APP_TEMPLATES'
  title: title
  pageLocals: pageLocals


# Remove Preprocessor extension
removeExt = (filename, ext) ->
  newFilename = (/([a-z_\-0-9]*\.[a-z_\-0-9]*)(\.[a-z_\-0-9]*)?$/i).exec(filename)?[1]
  if newFilename? then newFilename else false

withoutItem = (array, excluded) ->
  (item for item in array when item isnt excluded)

itemToLast = (array, item) ->
  withoutItem(array, item).concat [item]

commentDelimiters =
  js: '//'
  coffee: '#'

extractRequires = do ->
  regexes = {}
  (txt, commentDelimiter) ->
    requireRegexp = regexes[commentDelimiter]
    unless requireRegexp?
      requireRegexp = new RegExp "^\\s*#{commentDelimiter}\= require ['\"]([^'\"]*)['\"]$", 'gim'
      regexes[commentDelimiter] = requireRegexp

    requiredFiles = requireRegexp.exec(txt)?.slice(1)

    if requiredFiles? then requiredFiles else []

extractJSRequires = (txt, filename) ->
  compiler = getCompiler filename
  if compiler
    extractRequires txt, commentDelimiters[compiler]
  else
    extractRequires txt, commentDelimiters.js

concatFiles = (files, compile, requireFunc, root) ->
  txt = ''
  filesRead = {}
  while files.length > 0
    file = files[0]
    fileTxt = filesRead[file]
    unless fileTxt?
      fileTxt = fs.readFileSync file, 'utf8'
      filesRead[file] = fileTxt

    requires = requireFunc fileTxt, file
    if do (->
      for filename in files
        return true if removeExt(path.relative(root, filename)) in requires
      return false
    )
      files = itemToLast(files, file)
    else
      delete filesRead[file]
      files = withoutItem(files, file)
      txt += compile fileTxt, file

  return txt

concatJSDir = (dir, minify) ->
  files = jsFilter getFiles(dir)
  concatFiles files, compileJS, extractJSRequires, dir

concatCSSDir = (dir, minify) ->
  files = cssFilter getFiles(dir)
  concatFiles files, compileCSS, -> []

isInsideDir = (dir, containingDir) ->
  return false unless dir? and containingDir?
  dir           += '/' unless dir.slice(-1)           is '/'
  containingDir += '/' unless containingDir.slice(-1) is '/'
  dir.indexOf(containingDir) is 0

# Recursively creates directories
mkdirRecursive = (dirname) ->
  unless path.existsSync(dirname)
    mkdirRecursive(path.dirname dirname)
    fs.mkdirSync dirname

# Recursively creates directories in file path before writing to file
writeFileRecursive = (filename, data, encoding) ->
  mkdirRecursive path.dirname(filename)
  fs.writeFileSync filename, data, encoding

copyTree = (fromPath, toPath) ->
  files = getFiles fromPath
  for filename in files
    targetFilename = path.join toPath, path.relative(fromPath, filename)
    data = fs.readFileSync filename
    writeFileRecursive targetFilename, data

compileCoffeeFileTo = (file, target, modify=(n)->n) ->
  js = jsExtensions['coffee'] fs.readFileSync(file, 'utf8')
  writeFileRecursive target, modify(js), 'utf8'

compileJSDir = (dir, target) ->
  for file in jsFilter getFiles(dir)
    js = compileJSFile file
    filename = path.join target, path.basename(removeExt file)
    writeFileRecursive filename, js, 'utf8'

build = (config) ->
  src = config.src
  jsDirs = config.concatJS
  cssDirs = config.concatCSS
  target = config.build
  if target and path.existsSync(target)
    fs.rmdir target
  else if not target
    return

  files       = getFiles src
  layoutPath  = path.join src, config.layout
  concatToTarget = (dir, filename, func) ->
    txt = func dir, true
    writeFileRecursive path.join(target, filename), txt

  jsDirsPath  = if jsDirs
    path.join src, jsDirs
  else null
  cssDirsPath = if cssDirs
    path.join src, cssDirs
  else null
  templatePath = path.join src, config.templates

  for filename in files
    fileDir = path.dirname filename
    if filename is layoutPath or isInsideDir(
      fileDir, jsDirsPath
    ) or isInsideDir(fileDir, cssDirsPath) or isInsideDir(fileDir, templatePath)
      continue
    else
      data = readFile filename, config
      data = fs.readFileSync(filename) unless data

      relativeFilename = path.relative src, filename
      basename = removeExt(relativeFilename) or relativeFilename
      targetFilename = path.join(target, path.join(path.dirname(relativeFilename), basename))
      writeFileRecursive targetFilename, data

  concatToTarget(jsDirsPath,  'js/app.js',   concatJSDir)  if jsDirs?
  concatToTarget(cssDirsPath, 'css/app.css', concatCSSDir) if cssDirs?

jsRoute = (jsPath) ->
  (req, res) ->
    res.contentType 'application/javascript; charset=utf-8'
    res.send concatJSDir jsPath

cssRoute = (cssPath) ->
  (req, res) ->
    res.contentType 'text/css'
    res.send concatCSSDir cssPath

preprocessorRoute = (appPath, config) ->
  (req, res, next) ->
    filename = req.params[0]
    filePath = path.join appPath, filename

    title = config.pages?[filename]?.title or config.title

    fs.stat filePath, (err, fileStats) ->
      if fileStats and fileStats.isDirectory()
        next()
      else
        txt = readFile filePath, config

        if txt
          ft = fileType filePath
          switch ft
            when 'js'   then res.contentType 'application/javascript'
            when 'css'  then res.contentType 'text/css'
            when 'html' then res.contentType 'text/html'
          res.send txt
        else
          next()

addProxyRoutes = (app, routesHash) ->
  for own route, proxyConfig of routesHash
    do (route) ->
      app.all path.join(route, '*'), (req, res) ->
        url = path.relative route, req.url
        proxyReqConfig =
          hostname: proxyConfig.hostname or 'localhost'
          port: proxyConfig.port or 8080
          method: req.method
          path: path.join (proxyConfig.path or '/'), url
          headers: req.headers
          auth: req.auth

        proxyReq = http.request(proxyReqConfig, (proxyRes) ->
          data = ''
          proxyRes.on 'data', (resData) -> data += resData
          proxyRes.on 'end', ->
            for own header, value in proxyRes.headers
              res.header header, value
            res.contentType proxyRes.header('content-type')
            res.send data
        )
        if req.method isnt 'GET'
          proxyReq.write JSON.stringify req.body

        proxyReq.end()


module.exports.getFiles            = getFiles
module.exports.fileType            = fileType
module.exports.concatJSDir         = concatJSDir
module.exports.concatCSSDir        = concatCSSDir
module.exports.compileJSDir        = compileJSDir
module.exports.compileJSFile       = compileJSFile
module.exports.compileCoffeeFileTo = compileCoffeeFileTo
module.exports.compileHTMLFile     = compileHTMLFile
module.exports.removeExt           = removeExt
module.exports.readHTMLPage        = readHTMLPage
module.exports.readFile            = readFile
module.exports.writeFileRecursive  = writeFileRecursive
module.exports.copyTree            = copyTree
module.exports.build               = build

module.exports.jsRoute             = jsRoute
module.exports.cssRoute            = cssRoute
module.exports.preprocessorRoute   = preprocessorRoute
module.exports.addProxyRoutes      = addProxyRoutes

