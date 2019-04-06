
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
const {findRoots, copyExampleMaybe, toCmdArgs, configCmdArgs, spawnDetached, findTargets, getMtime, readJson, writeJson} = require('./Utils')
const QtCppWatcher = require('./QtCppWatcher')
const Manager = require('./Manager')

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

//copyExampleMaybe('targets.json')

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

//var targets = readJson(path.join(__dirname,'targets.json'))
//findTargets(targets)

let config2Path = path.join(__dirname,'..','config2.json')

let config2 = readJson(config2Path) || {}

//var bookmarks = readJson('bookmarks.json')
var config = readJson(path.join(__dirname,'config.json'))
config.active = true

if (config.mode === undefined) {
    config.mode = 'debug'
}

//debug('config',config)

var trafficLights = new TrafficLights(config.serialPort)
var makeStat = new MakeStat()

var taskQueue = new TaskQueue(makeStat, trafficLights, config)

//var roots = findRoots(targets)
//debug('roots',roots)

//var watchHandler = new QtCppWatcher(config, targets, taskQueue)

var manager = new Manager(taskQueue)

manager.update(config2, config.mode)

/*
roots.forEach(root => {
    if (process.platform === 'win32') {
        fs.watch(root,{recursive:true},(event,filename) => {
            if (filename !== null && (event === 'change' || event === 'rename' )) {
                watchHandler.handle(root, filename)
            }
        })
    } else {
        var watcher = chokidar.watch(root,{ignoreInitial:true})
        let handle = (filename) => watchHandler.handle(root, filename)
        var events = ['add','change','unlink']
        events.forEach(event => watcher.on(event, handle))
    }
})*/

io.on('connection', (socket) => {
    debug('io connection')
    //taskQueue.socket = socket
    taskQueue.setSocket(socket)

    /*socket.on('targets',()=>{
        socket.emit('targets',targets)
    })*/

    socket.on('mtime',()=>{
        /*var mtime = getMtime(targets)
        socket.emit('mtime',mtime)*/
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

        let {cwd,lineNum,colNum} = obj

        let path_ = obj.path

        if (!path.isAbsolute(path_)) {
            path_ = path.join(obj.cwd, path_)
        }
        if (obj.lineNum !== undefined) {
            path_ = path_ + ':' + obj.lineNum
        }
        // qtcreator doesn't understand path:row:col format
        /*if (obj.colNum !== null) {
            path_ = path_ + ':' + obj.colNum
        }*/
        let [cmd, args] = toCmdArgs(config.editor, [path_])
        debug(obj, cmd, args)
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

    socket.on('setConfig',(config) => {
        writeJson(config2Path,config)
        config2 = config
        manager.update(config2, config.mode)
    })

    socket.on('config',()=>{
        socket.emit('config',config2)
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
