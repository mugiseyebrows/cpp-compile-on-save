
const express = require('express')
var path = require('path')
var app = express()
var server = require('http').createServer(app)
var io = require('socket.io')(server)

var debug = require('debug')('server')
const fs = require('fs')

const TaskQueue = require('./TaskQueue')
const TrafficLights = require('./TrafficLights')
const MakeStat = require('./MakeStat')
const {findRoots, findTarget, copyExampleMaybe, toCmdArgs, spawnDetached, guessPro, updateMtime, updateMakeStat, readJson} = require('./Utils')

var port = 4000;
server.listen(port, () => {
    console.log(`Server listening at port ${port}`)
})

var build = path.join(__dirname,'..', 'build')
var public = path.join(__dirname,'..', 'public')
if (fs.existsSync(build)) {
    debug(`serving ${build}`)
    app.use(express.static(build))
} else {
    debug(`serving ${public}`)
    app.use(express.static(public))
}

copyExampleMaybe('targets.json')
copyExampleMaybe('bookmarks.json')
copyExampleMaybe('config.json')

var targets = readJson('targets.json')
guessPro(targets)

var bookmarks = readJson('bookmarks.json')
var config = readJson('config.json')

var trafficLights = new TrafficLights(config.serialPort)
var makeStat = new MakeStat()

var taskQueue = new TaskQueue(makeStat, trafficLights, config)

var roots = findRoots(targets)
debug('roots',roots)

var active = true;

var sourceExts = new Set(['.ui','.cpp','.h','.pro'])
var binaryExts = new Set(['.dll','.exe'])

roots.forEach(root => {
    fs.watch(root,{recursive:true},(event,filename) => {
        
        if (filename === null) {
            debug('filename is null',event)
            return
        }
        if (event == "change" || event == "rename") {
            var basename = path.basename(filename)
            var ext = path.extname(basename)
            var absFileName = path.join(root,filename)
            if (basename.match(/moc_|ui_|qrc_/)) {
                return;
            } else if (binaryExts.has(ext)) {
                taskQueue.emit('binary-changed',absFileName)
            } else if (sourceExts.has(ext)) {
                if (!active) {
                    return
                }
                var target = findTarget(targets,absFileName)
                taskQueue.add({cmd:'make',mode:'debug',cwd:target.cwd,kill:target.kill})
            }
        }
    })
})


io.on('connection', (socket) => {
    debug('io connection')
    //taskQueue.socket = socket
    taskQueue.setSocket(socket)

    socket.on('targets',()=>{
        
        updateMakeStat(targets,makeStat)
        updateMtime(targets)

        socket.emit('targets',targets)
    })

    socket.on('bookmarks',() => {
        socket.emit('bookmarks',bookmarks)
    })

    socket.on('open-bookmark', bookmark => {
        let [cmd, args] = toCmdArgs(bookmarks[bookmark])
        spawnDetached(cmd, args)
    })

    socket.on('open-file', obj => {
        let pathArg
        if (path.isAbsolute(obj.path)) {
            pathArg = obj.path
        } else {
            pathArg = path.join(obj.cwd, obj.path)
        }
        if (obj.lineNum !== null) {
            pathArg = pathArg + ':' + obj.lineNum
        }
        let [cmd, args] = toCmdArgs(config.editor, [pathArg])
        debug(cmd, args)
        spawnDetached(cmd, args)
    })

    socket.on('set-active', value=>{
        debug('set-active',value)
        active = value;
    })

    socket.on('make-all', mode => {
        debug('make-all',mode)
        targets.forEach(target => {
            var task = {cmd:'make', mode:mode, cwd:target.cwd, kill:target.kill}
            taskQueue.add(task)
        })
    })

    socket.on('project-command', opts => {
        let {command, target, mode} = opts;
        
        debug('project-command', opts)

        let commands = {
            edit: () => {
                let [cmd, args] = toCmdArgs(config.editor, [target.pro])
                spawnDetached(cmd, args)
            },
            qmake: () => {
                var task = {cmd:'qmake', mode:mode, cwd:target.cwd}
                taskQueue.add(task)
            },
            gitk: () => {
                let [cmd, args] = toCmdArgs(config.gitk)
                spawnDetached(cmd, args, {cwd:target.cwd})
            },
            bash: () => {
                let [cmd, args] = toCmdArgs(config.bash)
                spawnDetached(cmd, args, {cwd:target.cwd})
            },
            make: () => {
                var task = {cmd:'make', mode:mode, cwd:target.cwd}
                taskQueue.add(task)
            },
            explore: () => {
                let [cmd,args] = toCmdArgs(config.explorer, [target.cwd])
                spawnDetached(cmd, args)
            }
        }

        if (commands[command] == null) {
            console.log('unexpected project-command',command)
        } else {
            commands[command]();
        }
        
    })

})


