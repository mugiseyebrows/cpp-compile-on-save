

const express = require('express')
var path = require('path')
var app = express()
var server = require('http').createServer(app)
var io = require('socket.io')(server)

var debug = require('debug')('server')
const fs = require('fs')
const fse = require('fs-extra')
const {spawn} = require('child_process')

const TaskQueue = require('./TaskQueue')
const TrafficLights = require('./TrafficLights')
const CompileStat = require('./CompileStat')
const {findRoots, findTarget} = require('./Utils')

var port = 4000;
server.listen(port, () => {
    console.log('Server listening at port %d', port);
});

var build = path.join(__dirname,'..', 'build')
var public = path.join(__dirname,'..', 'public')
if (fs.existsSync(build)) {
    debug(`serving ${build}`)
    app.use(express.static(build))
} else {
    debug(`serving ${public}`)
    app.use(express.static(public))
}

var targets = fse.readJsonSync(path.join(__dirname,'targets.json'))
var bookmarks = fse.readJsonSync(path.join(__dirname,'bookmarks.json'))
var config = fse.readJsonSync(path.join(__dirname,'config.json'))

var trafficLights = new TrafficLights(config.serialPort)
var compileStat = new CompileStat()

var taskQueue = new TaskQueue(compileStat, trafficLights, config)

var roots = findRoots(targets)

var active = true;

var sourceExts = new Set(['.ui','.cpp','.h','.pro'])
var binaryExts = new Set(['.dll','.exe'])

roots.forEach(root => {
    fs.watch(root,{recursive:true},(event,filename) => {
        
        if (filename === null) {
            debug('filename is null, weird',event)
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

    socket.on('get-targets',()=>{
        
        var targets_ = targets.map(target => {
            var modes = ['debug','release']

            target['compileTime'] = {}
            target['compileCode'] = {}
            target['Mtime'] = {}

            modes.forEach( mode => {
                if (fs.existsSync(target[mode])) {
                    target['Mtime'][mode] = fs.statSync(target[mode]).mtime
                } else {
                    target['Mtime'][mode] = null
                }
                var stat = compileStat.get(target.cwd, mode)
                if (stat !== null) {
                    target['compileTime'][mode] = stat.t
                    target['compileCode'][mode] = stat.code
                } else {
                    target['compileTime'][mode] = null
                    target['compileCode'][mode] = null
                }
            })

            return target
        })

        socket.emit('targets',targets_)
    })

    socket.on('get-bookmarks',() => {
        socket.emit('bookmarks',bookmarks)
    })

    socket.on('open-bookmark', bookmark => {
        let cmd = bookmarks[bookmark][0]
        let args = bookmarks[bookmark][1] || []
        spawn(cmd, args)
    })

    socket.on('open-file', filename => {
        let cmd = config.editor[0]
        let args = [...config.editor[1], filename]
        spawn(cmd, args)
    })

    socket.on('open-dir', filename => {
        let cmd = config.explorer[0]
        let args = [...config.explorer[1], filename]
        spawn(cmd, args)
    })

    socket.on('set-active', value=>{
        debug('set-active',value)
        active = value;
    })

    socket.on('compile-all', mode => {
        targets.forEach(target => {
            var task = {cmd:'make',mode:mode,cwd:target.cwd,kill:target.kill}
            taskQueue.add(task)
        })
    })

    socket.on('compile-one', target => {
        var task = {cmd:'make',mode:target.mode,cwd:target.cwd}
        taskQueue.add(task)
    })

    socket.on('open-project', project => {
        let cmd = config.editor[0]
        let args = [...config.editor[1], project]
        spawn(cmd, args)
    })

})


