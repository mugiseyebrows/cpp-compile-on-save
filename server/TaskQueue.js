

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
            if (!task.kill || task.kill.length === 0) {
                return
            }
            let lines = data.toString().split('\n')
            let cannotOpen = lines.filter(line => line.indexOf('cannot open output') > -1 || line.indexOf('Permission denied') > -1)
            if (cannotOpen.length === 0) {
                return
            }
            let kill = task.kill.split(' ').filter(e => e.length)
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
        if (newTask.cwd === undefined) {
            return false;
        }
        return this.tasks.filter( task => task.cwd == newTask.cwd && task.mode == newTask.mode && task.cmd == newTask.cmd ).length > 0
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

        let {name, target, mode, cwd, file, env} = opts

        if (!cwd) {
            if (target) {
                cwd = target.cwd
            }
        }

        let commands = this._config.commands

        let command = commands.items.find(c => c.name == name)
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
            env_ = defaults(env_, {PATH: path, Path: path})
        }

        //debug('env.PATH',env.PATH)
        
        return {cmd:cmd_[0], args:cmd_.slice(1), env:env_}

        /*var repl = {
            '$mode': mode,
            '$cwd': cwd
        }
        if (target != null) {
            repl['$pro'] = target.pro || path.join(cwd, fs.readdirSync(cwd).find(name => name.endsWith('.pro')))
        } else {
            
        }
        let [cmd, args] = toCmdArgs(cmd_, args_, repl)
        return {cmd:cmd, args:args}

        return command*/
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

    add(newTask, front, target) {

        if (newTask != null) {
            if (!this.hasTask(newTask)) {

                newTask.env = this._env
                debug(`adding to tasklist`,newTask)
                if (front == true) {
                    this.tasks = [newTask,...this.tasks]
                } else {
                    this.tasks.push(newTask)
                }
                debug(`${this.tasks.length} tasks queued`)
            } else {
                debug(newTask,`already in tasklist`)
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

            if (task.cmd != 'kill') {

                var cwd = task.cwd

                var t = +new Date()
                
                let {cmd,args,env} = this.makeCommand({name:task.cmd, target, mode:task.mode, env: this._env})

                //console.log('cmd,args',cmd,args)

                try {
                    this.proc = spawn(cmd, args, {cwd,env})
                } catch (e) {
                    debug(`failed to spawn`,cmd,args)
                    return
                }
                
                this._killer.listen(this.proc, task, (...args) => {
                    this.add(...args)
                })

                this.emit('proc-start', {cwd:task.cwd, mode:task.mode, cmd:task.cmd})

                this.trafficLights.blue()

                this._cacher.listen(this.proc, cwd)

                if (task.name === undefined) {
                    debug(`task.name === undefined 1`)
                }

                if (task.cmd == 'make' && task.mode !== 'clean') {
                    this.makeStat.set(task.name, task.mode, null, null)
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
                    if (task.cmd == 'make') {
                        this.makeStat.set(task.name, task.mode, code, t)
                        this.emitMakeStat()
                    }
                    this.running = null
                    this.add(null)
                })

            } else if (task.cmd == 'kill') {

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