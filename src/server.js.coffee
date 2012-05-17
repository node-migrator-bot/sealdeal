
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

    app.get '/js/app.js', sealdeal.jsRoute appPath, config

    app.get '/css/app.css', sealdeal.cssRoute appPath, config

    preprocessor = sealdeal.preprocessorRoute appPath, config

    app.get '/*', preprocessor
    app.get '/', (req, res, next) ->
      req.params[0] = "/index.html"
      preprocessor req, res, next

    app.listen 3000
    console.log "Express server listening on port %d in %s mode", app.address().port, app.settings.env
