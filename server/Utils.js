

const path = require('path')
const fs = require('fs')
const {spawn} = require('child_process')
const debug = require('debug')('cpp-compile-on-save')
const fse = require('fs-extra')

function isPathContains(parent,child) {
    let p = parent.split('\\')
    let c = child.split('\\')
    if (c.length < p.length) {
        return false
    }
    for(let i=0;i<p.length;i++) {
        if (p[i] !== c[i]) {
            return false
        }
    }
    return true
}

function findRoots(targets) {
    var targets_  = targets.slice()
    targets_.sort( (a,b) => a.cwd.split('\\').length < b.cwd.split('\\').length ? -1 : 1 )
    var roots = []
    targets_.forEach(target => {
        if (roots.map( root => isPathContains(root, target.cwd) ).filter( e => e != false ).length == 0) {
            roots.push(target.cwd)
        }
    })
    return roots
}

function findTarget(targets,p) {
    var targets_  = targets.slice()
    targets_.sort( (a,b) => a.cwd.split('\\').length < b.cwd.split('\\').length ? 1 : -1 )
    for(var i=0;i<targets_.length;i++) {
        if (isPathContains(targets_[i].cwd,p)) {
            return targets_[i];
        }
    }
}

function copyExampleMaybe(name) {
    let dst = path.join(__dirname,name)
    if (!fs.existsSync(dst)) {
        let src = path.join(__dirname, name + '.example')
        debug(`cp ${src} ${dst}`)
        fs.copyFileSync(src,dst)
    }
}

function configCmdArgs(config, command, target, mode, cwd) {
    let [cmd_, args_] = [config.commands.shown, config.commands.hidden, config.bookmarks].map( e => e.find(c => c.name === command) ).find( e => e != null ).cmd
    var repl = {
        '$mode': mode,
        '$cwd': cwd
    }
    if (target != null) {
        repl['$projectFile'] = target.pro
    } else {
        
    }
    let [cmd, args] = toCmdArgs(cmd_, args_, repl)
    return {cmd:cmd, args:args}
} 

function toCmdArgs(exp, args2, repl) {
    let cmd, args0
    if (Array.isArray(exp)) {
        cmd = exp[0]
        args0 = exp[1] || []
    } else {
        cmd = exp
        args0 = []
    }
    args2 = args2 || []
    let args = [...args0,...args2].map(a=>{
        for(var k in repl) {
            a = a.replace(k,repl[k])
        }
        return a
    })
    return [cmd,args]
}

function spawnDetached(cmd,args,opts) {
    args = args || []
    opts = Object.assign({},opts,{detached: true, stdio: 'ignore'})
    //debug('spawnDetached',cmd,args,opts)
    let child = spawn(cmd,args,opts)
    child.unref()
}

function guessPro(targets) {
    targets.forEach(target => {
        let pro = target.pro || path.join(target.cwd, target.name + '.pro')
        if (!fs.existsSync(pro)) {
            var pros = fs.readdirSync(target.cwd).filter( name => name.toLowerCase().endsWith('.pro') )
            if (pros.length > 0) {
                pro = path.join(target.cwd, pros[0])
            }
        }
        target.pro = pro
    })
}

function readTargetFromPro(p) {
    let pro = fs.readFileSync(p,'utf8').split('\n')
    let names = pro.map(line => {
        var m = line.match(/TARGET\s*=\s*([^\s]+)/)
        if (m) {
            m = m[1]
        }
        return m
    }).filter(e=>e)
    if (names.length > 0) {
        return names[0]
    }
    return null
}


function findTargets(targets) {
    guessPro(targets)
    targets.forEach(target => {
        if (target.type && ['qt-lib','qt-app'].indexOf(target.type)) {


            if (process.platform === 'win32') {

                let name;
                if (target.name) {
                    name = target.name
                } else {
                    var name_ = null
                    if (target.pro && fs.existsSync(target.pro)) {
                        name_ = readTargetFromPro(target.pro)
                    }
                    name = name_ || path.basename(target.cwd)
                    target.name = name
                }
                
                let modes = ['debug','release']
                modes.forEach(mode => {
                    if (target[mode] === undefined) {
                        target[mode] = path.join(target.cwd, mode, name + (target.type == 'qt-app' ? '.exe' : '.dll'))
                    }
                })
                if (target.kill === undefined && target.type == 'qt-app') {
                    target.kill = [name + '.exe']
                }

                //debug(target)

            } else if (process.platform === 'linux') {
                // todo

            }

        }
    })
}

function getMtime(targets) {
    let modes = ['debug','release']
    let mtime = {}

    targets.forEach(target => {
        mtime[target.name] = {
            debug:null,
            release:null
        }
        modes.forEach(mode => {
            if (fs.existsSync(target[mode])) {
                mtime[target.name][mode] = fs.statSync(target[mode]).mtime
            }
        })
    })
    return mtime
}

function readJson(name) {
    return fse.readJsonSync(path.join(__dirname,name))
}


module.exports = {isPathContains:isPathContains, findRoots:findRoots, findTarget:findTarget, 
    copyExampleMaybe:copyExampleMaybe, toCmdArgs:toCmdArgs, spawnDetached:spawnDetached, 
    guessPro:guessPro, readJson:readJson, getMtime:getMtime, configCmdArgs:configCmdArgs,
    findTargets:findTargets
}

