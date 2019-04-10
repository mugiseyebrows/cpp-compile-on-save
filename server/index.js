
const express = require('express')
const path = require('path')
const app = express()
const server = require('http').createServer(app)
const io = require('socket.io')(server)

/* 
set DEBUG=cpp-compile-on-save
export DEBUG=cpp-compile-on-save
*/

const debug = require('debug')('cpp-compile-on-save')
const fs = require('fs')

const TaskQueue = require('./TaskQueue')
const TrafficLights = require('./TrafficLights')
const MakeStat = require('./MakeStat')
const {spawnDetached, getMtime2, readJson, writeJson} = require('./Utils')
const Manager = require('./Manager')

var port = 4000;
server.listen(port, () => {
    console.log(`Server listening at port ${port}`)
})

var build = path.join(__dirname,'..', 'build')

if (fs.existsSync(build)) {
    debug(`serving ${build}`)
    app.use(express.static(build))
} 

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

let config2Path = path.join(__dirname,'..','config2.json')

let config2 = readJson(config2Path) || {}

//var bookmarks = readJson('bookmarks.json')
var config = readJson(path.join(__dirname,'config.json'))

var trafficLights = new TrafficLights(config.serialPort)
var makeStat = new MakeStat()

var taskQueue = new TaskQueue(makeStat, trafficLights, config)

var manager = new Manager(taskQueue)
manager.mode = 'debug'
manager.active = true
manager.config = config2

io.on('connection', (socket) => {
    debug('io connection')
    
    // pipe taskQueue events to socket
    taskQueue.eventNames().forEach(name => {
        taskQueue.on(name, (obj) => {
            socket.emit(name,obj)
        })
    })

    socket.on('mtime',()=>{
        var mtime = getMtime2(config2.targets)
        //debug('mtime',mtime)
        socket.emit('mtime',mtime)
    })

    socket.on('bookmarks',() => {
        socket.emit('bookmarks',config.bookmarks)
    })

    socket.on('open-bookmark', name => {
        let {cmd, args} = taskQueue.makeCommand(name)
        if (cmd) {
            spawnDetached(cmd, args)
        } else {
            debug(`${name} bookmark not found`)
        }
    })

    socket.on('edit-file', obj => {

        let {cwd,lineNum} = obj
        let path_ = obj.path

        if (!path.isAbsolute(path_)) {
            path_ = path.join(cwd, path_)
        }
        if (lineNum !== undefined) {
            path_ = path_ + ':' + lineNum
        }
        // qtcreator doesn't understand path:row:col format
        /*if (obj.colNum !== null) {
            path_ = path_ + ':' + obj.colNum
        }*/
        //let [cmd, args] = toCmdArgs(config.editor, [path_])

        let {cmd, args} = taskQueue.makeCommand('edit-file',null,null,cwd,path_)

        if (cmd) {
            spawnDetached(cmd, args)
        } else {
            debug(`edit-file not found in config`)
        }

    })

    socket.on('set-active', value=>{
        debug('set-active',value)
        //config.active = value
        manager.active = value
    })

    socket.on('is-active',()=>{
        socket.emit('is-active',manager.active)
    })

    socket.on('set-mode', mode => {
        debug('set-mode', mode)
        manager.mode = mode
        socket.emit('get-mode',manager.mode)
    })

    socket.on('get-mode', () => {
        debug('get-mode', manager.mode)
        socket.emit('get-mode', manager.mode)
    })

    socket.on('cancel', () => {
        debug('cancel')
        taskQueue.cancel()
    })

    socket.on('abort', () => {
        debug('abort')
        taskQueue.abort()
    })

    /*socket.on('edit-targets',()=>{
        debug('edit-targets')
        let targets = path.join(__dirname,'targets.json')
        let [cmd, args] = toCmdArgs(config.configEditor, [targets])
        spawnDetached(cmd, args)
    })*/

    socket.on('commands',()=>{
        socket.emit('commands',config.commands)
    })

    socket.on('make-stat',()=>{
        debug('make-stat')
        socket.emit('make-stat',makeStat.stat)
    })

    socket.on('set-config',(config) => {
        
        writeJson(config2Path,config)
        config2 = config
        manager.config = config2
    })

    socket.on('config',()=>{
        socket.emit('config',config2)
    })


    socket.on('project-command', opts => {
        let {command, target, mode} = opts;
        
        debug('project-command', opts.command, target.name, mode)

        let command_ = config2.commands.items.find(c => c.name == command)

        if (!command_) {
            debug(`${command} not found in config`)
            return
        }

        if (command_.task === true) {
            var task = {cmd:command, mode, cwd:target.cwd, name: target.name}
            if (command == 'make') {
                task['kill'] = target.kill
            }
            taskQueue.add(task,false,target)
        } else {
            let {cmd, args} = taskQueue.makeCommand(command, target, mode, target.cwd)

            if (cmd) {
                spawnDetached(cmd, args, {cwd:target.cwd})
            } else {
                debug(`${command} not found in config`)
            }
        }
       
        
    })

})
