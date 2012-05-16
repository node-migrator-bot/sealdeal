fs   = require 'fs'
path = require 'path'
_    = require 'underscore'

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
  'less': (txt) ->
  'styl': requireCompiler 'stylus', (txt, compiler) ->
    css = ''
    compiler.render txt, (err, out) -> css = out
    return css
}

htmlExtensions = {
  'jade': requireCompiler 'jade', (txt, compiler) ->
    compiler.compile txt
  'ck': (txt) ->
}

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

compileFile = (filename, extensions) ->
  compiler = getCompiler filename
  compile = extensions[compiler]
  txt = fs.readFileSync filename, 'utf8'
  if compile? then compile(txt) else txt

compileHTMLFile = (filename) ->
  compileFile filename, htmlExtensions

compileJSFile = (filename) ->
  compileFile filename, jsExtensions

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

  content = compileHTMLFile args.filename
  if args.layout?
    context = args.layoutLocals or {}
    context.content = content args.pageLocals or {}
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

    compileHTMLFile(args.layout) context

  else content

readFile = (filename, config) ->
  args = fileConfig filename, config

  directory = path.dirname filename
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

  filename: filename
  layout: path.join config.src, config.layout
  templates: 'src/templates'
  templateNamespace: config.templateNamespace or 'APP_TEMPLATES'
  title: title


# Remove Preprocessor extension
removeExt = (filename, ext) ->
  newFilename = (/([a-z]*\.[a-z]*)(\.[a-z]*)?$/i).exec(filename)?[1]
  if newFilename? then newFilename else false

itemToLast = (array, item) ->
  _.without(array, item).push item

extractRequires = do ->
  regexes = {}
  (txt, commentDelimiter) ->
    requireRegexp = regexes[commentDelimiter]
    unless requireRegexp?
      requireRegexp = new RegExp "^#{commentDelimiter}\= require ['\"]([^'\"]*)['\"]$", 'gim'
      regexes[commentDelimiter] = requireRegexp

    requiredFiles = requireRegexp.exec(txt)?.slice(1)

    if requiredFiles? then requiredFiles else []

extractJSRequires = (txt) -> extractRequires txt, '//'

concatFiles = (files, compile, requireFunc) ->
  txt = ''
  compiled = {}
  while files.length > 0
    file = files[0]
    fileTxt = compiled[file]
    unless fileTxt?
      fileTxt = compile file
      compiled[file] = fileTxt

    requires = requireFunc fileTxt
    if _.intersection(files, requires).length
      itemToLast(files, file)
    else
      delete compiled[file]
      files = _.without(files, file)
      txt += fileTxt

  return txt

concatJSDir = (dir, minify) ->
  files = jsFilter getFiles(dir)
  concatFiles files, compileJSFile, extractJSRequires

concatCSSDir = (dir, minify) ->
  files = cssFilter getFiles(dir)
  concatFiles files, compileCSSFile, -> []

isInsideDir = (dir, containingDir) ->
  return false unless dir? and containingDir?
  dir           += '/' unless dir.slice(-1)           is '/'
  containingDir += '/' unless containingDir.slice(-1) is '/'
  dir.indexOf(containingDir) is 0

# Recursively creates directories in file path before writing to file
writeFileRecursive = (filename, data) ->
  mkdir = (dirname) ->
    unless path.existsSync(dirname)
      mkdir(path.dirname dirname)
      fs.mkdirSync dirname

  mkdir path.dirname(filename)
  fs.writeFileSync filename, data

copyTree = (fromPath, toPath) ->
  files = getFiles fromPath
  for filename in files
    targetFilename = path.join toPath, path.relative(fromPath, filename)
    data = fs.readFileSync filename
    writeFileRecursive targetFilename, data

compileJSDir = (dir, target) ->
  for file in jsFilter getFiles(dir)
    js = compileJSFile file
    filename = path.join target, path.basename(removeExt file)
    writeFileRecursive filename, js

build = (config) ->
  {src, concatJS, concatCSS} = config
  target = config.build

  files       = getFiles src
  layoutPath  = path.join src, config.layout
  concatToTarget = (dir, filename, func) ->
    txt = func dir, true
    writeFileRecursive path.join(target, filename), txt

  jsDirsPath  = if concatJS
    path.join src, concatJS
  else null
  cssDirsPath = if concatCSS
    path.join src, concatCSS
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
      targetFilename = path.join(target, path.join(path.dirname(relativeFilename), removeExt(relativeFilename)))
      writeFileRecursive targetFilename, data

  concatToTarget(jsDirsPath,  'js/app.js',   concatJSDir)  if concatJS?
  concatToTarget(cssDirsPath, 'css/app.css', concatCSSDir) if concatCSS?

module.exports.getFiles           = getFiles
module.exports.fileType           = fileType
module.exports.concatJSDir        = concatJSDir
module.exports.concatCSSDir       = concatCSSDir
module.exports.compileJSDir       = compileJSDir
module.exports.compileJSFile      = compileJSFile
module.exports.compileHTMLFile    = compileHTMLFile
module.exports.removeExt          = removeExt
module.exports.readHTMLPage       = readHTMLPage
module.exports.readFile           = readFile
module.exports.writeFileRecursive = writeFileRecursive
module.exports.copyTree           = copyTree
module.exports.build              = build

