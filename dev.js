const {spawn} = require('child_process')
const path = require('path')
let env = process.env
env['DEBUG'] = 'cpp-compile-on-save'
let opts = {shell:true, detached:true, cwd: __dirname, env}
spawn('nodemon',['-w','server',path.join('server','index.js')],opts)
spawn('npm',['run','start'],opts)
process.exit()