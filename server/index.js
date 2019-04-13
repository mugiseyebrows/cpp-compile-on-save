
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
manager.env = config2.envs.items[config2.envs.selected]

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
        debug('open-bookmark', name)
        let {cmd, args, env} = taskQueue.makeCommand({name, env:manager.env})

        //debug('open-bookmark env.PATH',env.PATH)

        if (cmd) {
            spawnDetached(cmd, args, {env})
        } else {
            debug(`${name} bookmark not found`)
        }
    })

    socket.on('edit-file', obj => {

        let {cwd,line} = obj
        let path_ = obj.path

        if (!path.isAbsolute(path_)) {
            path_ = path.join(cwd, path_)
        }
        if (line !== undefined) {
            path_ = path_ + ':' + line
        }
        // qtcreator doesn't understand path:row:col format
        /*if (obj.colNum !== null) {
            path_ = path_ + ':' + obj.colNum
        }*/
        //let [cmd, args] = toCmdArgs(config.editor, [path_])

        let {cmd, args, env} = taskQueue.makeCommand({name:'edit-file',cwd,file:path_,env:manager.env})

        if (cmd) {
            spawnDetached(cmd, args, {env})
        } else {
            debug(`edit-file not found in config`)
        }

    })

    socket.on('set-active', value=>{
        debug('set-active',value)
        //config.active = value
        manager.active = value
    })

    socket.on('active',()=>{
        socket.emit('active',manager.active)
    })

    socket.on('set-mode', mode => {
        debug('set-mode', mode)
        manager.mode = mode
        socket.emit('get-mode',manager.mode)
    })

    socket.on('mode', () => {
        debug('mode', manager.mode)
        socket.emit('mode', manager.mode)
    })

    socket.on('cancel', () => {
        debug('cancel')
        taskQueue.cancel()
    })

    socket.on('abort', () => {
        debug('abort')
        taskQueue.abort()
    })

    /*socket.on('commands',()=>{
        socket.emit('commands',config.commands)
    })*/

    socket.on('make-stat',()=>{
        debug('make-stat')
        socket.emit('make-stat',makeStat.stat)
    })

    socket.on('set-config',(config) => {
        debug('set-config')
        writeJson(config2Path,config)
        config2 = config
        manager.config = config2
    })

    socket.on('set-env',(env) => {
        debug('set-env',env)
        manager.env = env
    })

    socket.on('config',()=>{
        socket.emit('config',config2)
    })

    socket.on('qt-project', item => {
        let cwd = item.cwd
        let name = item.name

        if (cwd.length === 0) {
            debug('qt-project cwd is empty')
            return
        }
        if (name.length === 0) {
            debug('qt-project name is empty')
            return
        }

        let files = fs.readdirSync(cwd)

        if (process.platform === 'win32') {

            let modes = ['debug','release']
            modes.forEach(mode => {
                if (files.indexOf(mode) > -1) {
                    if (item[mode].length === 0) {
                        item[mode] = path.join(cwd,mode,name + '.exe')
                    }
                }
            })
            let pro = files.find(name => name.endsWith('.pro'))
            if (pro && item.pro.length === 0) {
                item.pro = pro
            }
            if (item.kill.length === 0) {
                item.kill = name + '.exe'
            }
            if (item.name.length === 0) {
                item.name = name
            }

            socket.emit('qt-project',item)

        } else {

        }

        
    })


    socket.on('project-command', opts => {
        let {name, target, mode} = opts;
        
        debug('project-command', opts.name, target.name, mode)

        let command = config2.commands.items.find(c => c.name === name)

        if (!command) {
            debug(`${command} not found in config`)
            return
        }

        if (command.task === true) {
            var task = {cmd:name, mode, cwd:target.cwd, name: target.name}
            if (command == 'make') {
                task['kill'] = target.kill
            }
            taskQueue.add(task,false,target)
        } else {
            let {cmd, args, env} = taskQueue.makeCommand({name, target, mode, cwd:target.cwd, env:taskQueue.env})

            debug(env.PATH)

            if (cmd) {
                spawnDetached(cmd, args, {cwd:target.cwd,env})
            } else {
                debug(`${command} not found in config`)
            }
        }
       
        
    })

})
