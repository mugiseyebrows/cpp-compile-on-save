
const express = require('express')
const path = require('path')
const app = express()
const server = require('http').createServer(app)
const io = require('socket.io')(server)
const chokidar = require('chokidar')

/* 
set DEBUG=cpp-compile-on-save
export DEBUG=cpp-compile-on-save
*/

const debug = require('debug')('cpp-compile-on-save')
const fs = require('fs')

const TaskQueue = require('./TaskQueue')
const TrafficLights = require('./TrafficLights')
const MakeStat = require('./MakeStat')
const {findRoots, copyExampleMaybe, toCmdArgs, configCmdArgs, spawnDetached, findTargets, getMtime, readJson} = require('./Utils')
const QtCppWatcher = require('./QtCppWatcher')

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

var configSrc = path.join(__dirname,'config.' + process.platform + '.json')
var configDst = path.join(__dirname,'config.json')

if (!fs.existsSync(configDst)) {
    if (fs.existsSync(configSrc)) {
        debug(`copy ${configSrc} to ${configDst}`)
        fs.copyFileSync(configSrc,configDst)
    } else {
        console.log(`example config file ${configSrc} does not exist`)
    }
}

copyExampleMaybe('config.json')

var targets = readJson('targets.json')
findTargets(targets)


//var bookmarks = readJson('bookmarks.json')
var config = readJson('config.json')
config.active = true

if (config.mode === undefined) {
    config.mode = 'debug'
}

//debug('config',config)

var trafficLights = new TrafficLights(config.serialPort)
var makeStat = new MakeStat()

var taskQueue = new TaskQueue(makeStat, trafficLights, config)

var roots = findRoots(targets)
//debug('roots',roots)

var watcher = new QtCppWatcher(config, targets, taskQueue)

roots.forEach(root => {

    var chokidarWatcher = chokidar.watch(root)

    let handler = (filename) => watcher.handle(root, filename)

    chokidarWatcher.on('add', handler )
    chokidarWatcher.on('change', handler )
    chokidarWatcher.on('unlink', handler )

})

io.on('connection', (socket) => {
    debug('io connection')
    //taskQueue.socket = socket
    taskQueue.setSocket(socket)

    socket.on('targets',()=>{
        socket.emit('targets',targets)
    })

    socket.on('mtime',()=>{
        var mtime = getMtime(targets)
        socket.emit('mtime',mtime)
    })

    socket.on('bookmarks',() => {
        socket.emit('bookmarks',config.bookmarks)
    })

    socket.on('open-bookmark', bookmark => {
        let {cmd, args} = configCmdArgs(config, bookmark.name, null, config.mode, __dirname)
        debug('open-bookmark',cmd,args)
        spawnDetached(cmd, args)
    })

    socket.on('open-file', obj => {
        let pathArg
        if (path.isAbsolute(obj.path)) {
            pathArg = obj.path
        } else {
            pathArg = path.join(obj.cwd, obj.path)
        }
        if (obj.lineNum !== undefined && obj.lineNum !== null) {
            pathArg = pathArg + ':' + obj.lineNum
        }
        let [cmd, args] = toCmdArgs(config.editor, [pathArg])
        debug(cmd, args)
        spawnDetached(cmd, args)
    })

    socket.on('set-active', value=>{
        debug('set-active',value)
        config.active = value
    })

    socket.on('is-active',()=>{
        debug('is-active',config.active)
        socket.emit('is-active',config.active)
    })

    socket.on('set-mode', newMode => {
        debug('set-mode', newMode)
        config.mode = newMode
        socket.emit('get-mode',config.mode)
    })

    socket.on('get-mode', () => {
        debug('get-mode', config.mode)
        socket.emit('get-mode', config.mode)
    })

    socket.on('cancel', () => {
        debug('cancel')
        taskQueue.cancel()
    })

    socket.on('abort', () => {
        debug('abort')
        taskQueue.abort()
    })

    socket.on('edit-targets',()=>{
        debug('edit-targets')
        let targets = path.join(__dirname,'targets.json')
        let [cmd, args] = toCmdArgs(config.configEditor, [targets])
        spawnDetached(cmd, args)
    })

    socket.on('commands',()=>{
        socket.emit('commands',config.commands)
    })

    socket.on('make-stat',()=>{
        debug('make-stat')
        socket.emit('make-stat',makeStat.stat)
    })

    socket.on('project-command', opts => {
        let {command, target, mode} = opts;
        
        debug('project-command', opts.command, target, mode)

        var command_ = [...config.commands.shown, ...config.commands.hidden].filter( c => c.name == command )

        if (command_.length == 1) {
            command_ = command_[0]

        } else {
            command_ = null
            if (command_.length > 1) {
                debug('ambigous command',command,command_)
            } else {
                debug('unknown command',command)
            }
        }

        if (command_.task === true) {
            var task = {cmd:command, mode:mode, cwd:target.cwd, name: target.name}
            if (command == 'make') {
                task['kill'] = target.kill
            }
            taskQueue.add(task,false,target)
        } else {
            let {cmd, args} = configCmdArgs(config, command, target, mode, target.cwd)
            spawnDetached(cmd, args, {cwd:target.cwd})
        }
       
        
    })

})
