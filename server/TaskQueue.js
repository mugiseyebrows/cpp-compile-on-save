

var debug = require('debug')('server')
const fkill = require('fkill')
const {spawn} = require('child_process')
const {toCmdArgs} = require('./Utils')

class TaskQueue {
    constructor(makeStat,trafficLights,config) {
        this.proc = null
        this.tasks = []
        this.socket = null
        this.handle = null
        this.makeStat = makeStat
        this.trafficLights = trafficLights
        this.config = config
    }

    setSocket(socket) {
        this.socket = socket
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
    }

    add(newTask, front) {

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

        this.emit('tasks',this.tasks)

        if (this.proc != null) {
            debug('process is running')
            return
        }

        if (this.tasks.length == 0) {
            debug('task queue is empty')
            this.emit('tasks',this.tasks)
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
            //this.emit('tasks',this.tasks)
            
            //debug(`compiling ${cwd}`)

            if (task.cmd == 'make' || task.cmd == 'qmake') {

                var cwd = task.cwd

                var t = +new Date()
                this.emit('proc-start', {cwd:task.cwd, mode:task.mode, cmd:task.cmd})
                
                var cmd, args
                if (task.cmd == 'make') {
                    [cmd, args] = toCmdArgs(this.config.make, [task.mode])
                } else {
                    [cmd, args] = toCmdArgs(this.config.qmake)
                }

                debug(cmd, args)
                this.proc = spawn(cmd, args, {cwd:cwd})
                this.trafficLights.blue()

                this.proc.stdout.on('data',(data)=>{
                    this.emit('proc-stdout',{data:data.toString(),cwd:cwd})
                    //debug('stdout',cmd,cwd)
                })

                this.proc.stderr.on('data',(data)=>{
                    //debug('stderr',cmd,cwd)

                    var lines = data.toString().split('\r\n')
                    if (lines.filter(line => line.indexOf('cannot open output') > -1).length > 0 ) {
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
                    
                    this.add(null)
                })

            } else if (task.cmd == 'kill') {

                debug(`killing ${task.proc}`)

                if (process.platform === 'win32') {

                    let cmd = 'taskkill'
                    let args = ['/f','/im',task.proc]
                    let proc = spawn(cmd, args)
                    proc.on('exit',(code)=>{
                        this.add(null)
                        debug(`taskkill exited with code ${code}`)
                    });

                } else {
                    fkill(task.proc,{force:true,tree:false}).then(()=>{
                        this.add(null)
                    }).catch((e)=>{
                        console.log('catched',e)
                        this.add(null)
                    })
                }

                

            }

        },500);
    }
}


module.exports = TaskQueue