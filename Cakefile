sealdeal = require './lib/sealdeal'

task "build", "compile coffeescript files to lib directory", (options) ->
  sealdeal.compileJSDir 'src', 'lib'
  sealdeal.compileCoffeeFileTo 'src/sealdeal-executable', 'bin/sealdeal', (js) ->
    "#!/usr/bin/env node\n#{js}"
