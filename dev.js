const {spawn} = require('child_process')
const path = require('path')
let env = process.env
env['DEBUG'] = 'cpp-compile-on-save'

function spawnShell(cmd) {
    let opts = {shell:true, detached:true, cwd: __dirname, env}
    let cmd_ = process.platform === 'win32' ? ('cmd /c ' + cmd).split(' ') : ('gnome-terminal -- ' + cmd).split(' ')
    spawn(cmd_[0],cmd_.slice(0),opts)
}

spawnShell('nodemon -w server ' + path.join('server','index.js'))
spawnShell('npm run start')
process.exit()