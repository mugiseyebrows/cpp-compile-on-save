

var debug = require('debug')('server')
const fkill = require('fkill')
const {spawn} = require('child_process')
const {configCmdArgs} = require('./Utils')

class TaskQueue {
    constructor(makeStat,trafficLights,config) {
        this.proc = null
        this.tasks = []
        this.socket = null
        this.handle = null
        this.makeStat = makeStat
        this.trafficLights = trafficLights
        this.config = config
        this.running = null
    }

    setSocket(socket) {
        this.socket = socket
    }

    emitTasks() {
        this.emit('tasks',{queued: this.tasks, running:this.running})
    }

    emit(type,data) {
        if (this.socket == null) {
            return;
        }
        this.socket.emit(type,data)
    }

    hasTask(newTask) {
        if (newTask.cwd == null) {
            return false;
        }
        return this.tasks.filter( task => task.cwd == newTask.cwd && task.mode == newTask.mode && task.cmd == newTask.cmd ).length > 0
    }

    clean() {
        this.tasks = []
        this.emitTasks()
    }

    abort() {
        this.clean()
        this.proc.kill()
    }

    add(newTask, front, target) {

        if (newTask != null) {
            if (!this.hasTask(newTask)) {
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
            
            var task = this.tasks.shift();

            this.running = task
            //this.emit('tasks',this.tasks)
            
            //debug(`compiling ${cwd}`)

            this.emitTasks()

            if (task.cmd != 'kill') {

                var cwd = task.cwd

                var t = +new Date()
                
                /*
                let [cmd_, args_] = this.config.exec[task.cmd]
                debug('cmd_, args_',task.cmd, cmd_, args_)
                var repl = {
                    '$mode': task.mode,
                    '$cwd': cwd
                }
                if (target != null) {
                    repl['$projectFile'] = target.pro
                } else {
                    debug('target is null')
                }

                let [cmd, args] = toCmdArgs(cmd_, args_, repl)
                debug('cmd, args',task.cmd, cmd, args)*/

                let {cmd,args} = configCmdArgs(this.config, task.cmd, target, task.mode, cwd)
               
                this.proc = spawn(cmd, args, {cwd:cwd})

                this.emit('proc-start', {cwd:task.cwd, mode:task.mode, cmd:task.cmd})

                this.trafficLights.blue()

                this.proc.stdout.on('data',(data)=>{
                    this.emit('proc-stdout',{data:data.toString(),cwd:cwd})
                    //debug('stdout',cmd,cwd)
                })

                this.proc.stderr.on('data',(data)=>{
                    //debug('stderr',cmd,cwd)

                    var lines = data.toString().split('\r\n')

                    var cannotOpen = lines.filter(line => line.indexOf('cannot open output') > -1 || line.indexOf('Permission denied') > -1)

                    if (cannotOpen.length > 0 ) {
                        debug('cannot open output => need to kill some tasks')
                        if (task.kill != null && task.kill.length > 0) {
                            this.add({cmd:'make',cwd:task.cwd,mode:task.mode},true)
                            task.kill.forEach( kill => this.add({cmd:'kill',proc:kill},true))
                        } else {
                            debug('task.kill is null or empty',task,task.kill)
                        }
                    }

                    this.emit('proc-stderr',{data:data.toString(),cwd:cwd})
                    //debug('proc-stderr',data.toString())
                })

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
                        this.makeStat.set(task.cwd, task.mode, code, t)
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