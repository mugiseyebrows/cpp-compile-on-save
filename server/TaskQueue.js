

const debug = require('debug')('cpp-compile-on-save')
const fkill = require('fkill')
const {spawn} = require('child_process')
const path = require('path')
const fs = require('fs')

const EventEmitter = require('events');

const StdStreamCacher = require('./StdStreamCacher')
const {defaults} = require('./Utils')

class Killer {
    listen(proc, task, add) {
        proc.stderr.on('data',(data) => {

            let kill = task.target.kill
            if (!kill || kill.length === 0) {
                return
            }
            let lines = data.toString().split('\n')
            let cannotOpen = lines.filter(line => line.indexOf('cannot open output') > -1 || line.indexOf('Permission denied') > -1)
            if (cannotOpen.length === 0) {
                return
            }
            kill = kill.split(' ').filter(e => e.length)
            add(task,true)
            kill.forEach(name => add({cmd:'kill',proc:name}, true))
        })
    }
}

/*
function clone(obj) {
    return Object.assign({},obj)
}
*/

function findPro(cwd) {
    let pro = fs.readdirSync(cwd).find(name => name.endsWith('.pro'))
    if (pro) {
        return path.join(cwd,pro)
    }
}

class TaskQueue extends EventEmitter {
    constructor(makeStat,trafficLights,config) {
        super()
        this.proc = null
        this.tasks = []

        this.handle = null
        this.makeStat = makeStat
        this.trafficLights = trafficLights
        this._config = config
        this.running = null
        this._killer = new Killer()
        let cacher = new StdStreamCacher()
        cacher.chans.forEach(chan => {
            cacher.on(chan,(data)=>{
                this.emit(chan, data)
            })
        })
        this._cacher = cacher        
    }

    eventNames() {
        return ['tasks','make-stat','proc-start','proc-exit','binary-changed'].concat(this._cacher.chans)
    }

    emitTasks() {
        this.emit('tasks',{queued: this.tasks, running:this.running})
    }

    emitMakeStat() {
        this.emit('make-stat',this.makeStat.stat)
    }

    hasTask(newTask) {
        let cwd = (item) => {
            return item.target ? item.target.cwd : item.cwd
        }
        return this.tasks.find(task => task.cmd === newTask.cmd && task.mode === newTask.mode && cwd(task) === cwd(newTask)) != undefined
    }

    cancel() {
        this.tasks = []
        this.emitTasks()
    }

    abort() {
        this.cancel()
        if (this.proc) {
            this.proc.kill()
        }
    }

    makeCommand(opts) {

        let {name, target, mode, cwd, file} = opts

        if (!cwd && target) {
            cwd = target.cwd
        }

        let env 
        if (!target) {
            env = this._env
        } else {
            if (target.envs.length === 0) {
                env = this._env
            } else {
                if (target.envs.indexOf(this._env.name)>-1) {
                    env = this._env
                } else {
                    env = this._config.envs.items.find(item => item.name == target.envs[0])
                }                
            }
        }

        let command = this._config.commands.items.find(c => c.name == name)
        if (!command) {
            debug('!command')
            return {}
        }
        
        let cmd_ = command.cmd

        if (cmd_.indexOf('$pro') > -1) {
            let pro = target.pro || ''
            if (pro.length == 0) {
                pro = findPro(cwd)
            }
            if (!pro) {
                debug(`cannot find pro in ${cwd}`)
                return {}
            } else {
                cmd_ = cmd_.replace('$pro', pro)
            }
        }
        cmd_ = cmd_.replace('$cwd',cwd)
        cmd_ = cmd_.replace('$mode',mode)

        if (file) {
            cmd_ = cmd_.replace('$file',file)
        }

        if (target) {
            cmd_ = cmd_.replace('$debug',target.debug)
            cmd_ = cmd_.replace('$release',target.release)
        }

        cmd_ = cmd_.split(' ')

        debug(cmd_)

        let env_ = process.env
        if (env && env.path && env.path.length > 0) {
            let path = env.path
            let path0 = process.env.PATH || process.env.Path || ''

            let sep = process.platform === 'win32' ? ';' : ':'

            if (env.mode === 'replace') {
                
            } else if (env.mode === 'append') {
                path = path0 + sep + path
            } else if (env.mode === 'prepend') {
                path = path + sep + path0
            } else {
                debug('mode', env.mode, env.name)
            }
            if (process.platform === 'win32') {
                env_ = defaults(env_, {PATH: path, Path: path})
            } else {
                env_ = defaults(env_, {PATH: path})
            }
        }

        return {cmd:cmd_[0], args:cmd_.slice(1), env:env_}
    }

    set config(value) {
        this._config = value
    }

    set env(env) {
        //debug('taskQueue env',env)
        this._env = env
    }

    get env() {
        return this._env
    }

    add(newTask, front) {

        if (newTask != null) {
            if (!this.hasTask(newTask)) {
                debug(`adding to tasklist ${newTask.cmd} ${newTask.mode} @ ${newTask.target ? newTask.target.cwd : newTask.cwd}`)
                if (front == true) {
                    this.tasks = [newTask,...this.tasks]
                } else {
                    this.tasks.push(newTask)
                }
                debug(`${this.tasks.length} tasks queued`)
            } else {
                debug(`already in tasklist ${newTask.cmd} ${newTask.mode} @ ${newTask.target ? newTask.target.cwd : newTask.cwd}`)
            }
        }

        this.emitTasks()

        if (this.proc != null) {
            debug('process is running')
            return
        }

        if (this.tasks.length == 0) {
            debug('task queue is empty')
            return
        }

        debug('lets wait 500ms and then compile')
        clearTimeout(this.handle)
        this.handle = setTimeout(()=>{

            if (this.proc != null) {
                debug('process is running')
                return
            }
            
            if (this.tasks.length == 0) {
                debug('task queue is empty')
                return
            }

            var task = this.tasks.shift();

            this.running = task
            //this.emit('tasks',this.tasks)
            
            //debug(`compiling ${cwd}`)

            this.emitTasks()

            if (task.cmd !== 'kill') {

                var t = +new Date()
                
                let {cmd,args,env} = this.makeCommand({name:task.cmd, target:task.target, mode:task.mode})

                //console.log('cmd,args',cmd,args)
                //debug(env.PATH)

                let cwd = task.target ? task.target.cwd : task.cwd

                try {
                    this.proc = spawn(cmd, args, {cwd,env})
                } catch (e) {
                    debug(`failed to spawn`,cmd,args)
                    return
                }
                
                this._killer.listen(this.proc, task, (...args) => {
                    this.add(...args)
                })

                this.emit('proc-start', {cwd: task.target ? task.target.cwd : task.cwd, mode:task.mode, cmd:task.cmd})

                this.trafficLights.blue()

                this._cacher.listen(this.proc, cwd)

                if (task.cmd == 'make' && task.mode !== 'clean') {
                    this.makeStat.set(task.target.name, task.mode, null, null)
                    this.emitMakeStat()
                }

                this.proc.on('exit',(code)=>{
                    t = +new Date() - t
                    this.emit('proc-exit',{code:code,time:t,cwd:cwd})
                    this.proc = null
                    debug(`process ${cmd} terminated with code ${code} in ${t}ms`)
                    if (code === 0) {
                        this.trafficLights.green()
                    } else {
                        this.trafficLights.red()
                    }
                    if (task.cmd === 'make') {
                        this.makeStat.set(task.target.name, task.mode, code, t)
                        this.emitMakeStat()
                    }
                    this.running = null
                    this.add(null)
                })

            } else if (task.cmd === 'kill') {

                debug(`killing ${task.proc}`)

                fkill(task.proc,{force:true}).then(()=>{
                    this.running = null
                    this.add(null)
                }).catch((e)=>{
                    console.log('catched',e)
                    this.running = null
                    this.add(null)
                })
                
            }

        },500)
    }
}


module.exports = TaskQueue