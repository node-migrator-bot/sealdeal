
#
# Module dependencies.
#

express  = require 'express'
fs       = require 'fs'
path     = require 'path'
sealdeal = require './sealdeal'

module.exports =
  run: (config) ->
    cwd    = process.cwd()
    app    = express.createServer()

    # Configuration

    app.configure ->
      app.use express.bodyParser()
      app.use express.methodOverride()
      app.use app.router


    app.configure ->
      app.use express.static path.join(cwd, config.src)

    app.configure 'development', ->
      app.use express.errorHandler({ dumpExceptions: true, showStack: true })

    app.configure 'production', ->
      app.use express.errorHandler()

    # Routes

    appPath = path.join cwd, config.src

    app.get '/js/app.js', (req, res) ->
      res.contentType 'application/javascript'
      res.send sealdeal.concatJSDir path.join(appPath, 'js/app')

    app.get '/css/app.css', (req, res) ->
      res.contentType 'text/css'
      res.send sealdeal.concatCSSDir path.join(appPath, 'css/app')

    preprocessor = (req, res, next) ->
      layout = path.join appPath, config.layout
      filename = req.params[0]
      filePath = path.join appPath, filename

      title = config.pages?[filename]?.title or config.title

      fs.stat filePath, (err, fileStats) ->
        if fileStats and fileStats.isDirectory()
          next()
        else
          txt = sealdeal.readFile filePath, config

          if txt
            fileType = sealdeal.fileType filePath
            switch fileType
              when 'js'   then res.contentType 'application/javascript'
              when 'css'  then res.contentType 'text/css'
              when 'html' then res.contentType 'text/html'
            res.send txt
          else
            next()

    app.get '/*', preprocessor
    app.get '/', (req, res, next) ->
      req.params[0] = "/index.html"
      preprocessor req, res, next

    app.listen 3000
    console.log "Express server listening on port %d in %s mode", app.address().port, app.settings.env
