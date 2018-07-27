

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

function pathContains(p,c) {
    p_ = p.split('\\')
    c_ = c.split('\\')
    if (c_.length < p_.length) {
        return false;
    }
    for(var i=0;i<p_.length;i++) {
        if (p_[i] !== c_[i]) {
            return false;
        }
    }
    return true;
}

function findRoots(targets) {
    var targets_  = targets.slice()
    targets_.sort( (a,b) => a.cwd.split('\\').length < b.cwd.split('\\').length ? -1 : 1 )
    var roots = [];
    targets_.forEach(target => {
        if (roots.map( root => pathContains(root, target.cwd) ).filter( e => e != false ).length == 0) {
            roots.push(target.cwd)
        }
    })
    return roots
}

function findTarget(targets,p) {
    var targets_  = targets.slice()
    targets_.sort( (a,b) => a.cwd.split('\\').length < b.cwd.split('\\').length ? 1 : -1 )
    for(var i=0;i<targets_.length;i++) {
        if (pathContains(targets_[i].cwd,p)) {
            return targets_[i];
        }
    }
}

var targets = fse.readJsonSync(path.join(__dirname,'targets.json'))
var bookmarks = fse.readJsonSync(path.join(__dirname,'bookmarks.json'))

var lights = new TrafficLights('COM6')
var compileStat = new CompileStat()

var taskQueue = new TaskQueue(compileStat,lights)

var roots = findRoots(targets)

var active = true;

var exts = new Set(['.ui','.cpp','.h','.pro'])
var exts2 = new Set(['.dll','.exe'])

roots.forEach(root => {
    fs.watch(root,{recursive:true},(event,filename) => {
        
        if (filename === null) {
            debug('filename is null, weird')
            return
        }
        if (event == "change" || event == "rename") {
            var basename = path.basename(filename)
            var filename_ = path.join(root,filename)
            if (basename.match(/moc_|ui_|qrc_/)) {
                return;
            } else if (exts2.has(path.extname(basename))) {
                taskQueue.emit('binary-changed',filename_)
            } else if (exts.has(path.extname(basename))) {
                if (!active) {
                    return
                }
                var target = findTarget(targets,filename_)
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
        //debug('get-targets')
        var targets = fse.readJsonSync(path.join(__dirname,'targets.json')).map(target => {
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

        socket.emit('targets',targets)
    })

    socket.on('get-bookmarks',()=>{
        socket.emit('bookmarks',bookmarks)
    })

    socket.on('open-bookmark',(k)=>{
        debug('open-bookmark',k)
        spawn(bookmarks[k][0],bookmarks[k][1] || [])
    })

    socket.on('open-file',filename=>{
        spawn('C:\\qt\\qtcreator-2.5.2\\bin\\qtcreator.exe',['-client',filename])
    })

    socket.on('open-dir',filename=>{
        spawn('explorer.exe',[filename])
    })

    socket.on('set-active',value=>{
        debug('set-active',value)
        active = value;
    })

    socket.on('compile-all',mode=>{
        targets.forEach(target => {
            var task = {cmd:'make',mode:mode,cwd:target.cwd,kill:target.kill}
            //debug(task)
            taskQueue.add(task)
        })
    })

    socket.on('compile-one',(target)=>{
        var task = {cmd:'make',mode:target.mode,cwd:target.cwd}
        taskQueue.add(task)
    })

    socket.on('open-project',(p)=>{
        spawn("C:\\qt\\qtcreator-2.5.2\\bin\\qtcreator.exe",['-client',p])
    })

})


