

const path = require('path')
const fs = require('fs')
const {spawn} = require('child_process')
var debug = require('debug')('server')
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
    debug('spawnDetached',opts)
    let child = spawn(cmd,args,opts)
    child.unref()
}

function guessPro(targets) {
    targets.forEach(target => {
        let pro = target.pro || path.join(target.cwd,target.name + '.pro')
        if (!fs.existsSync(pro)) {
            var pros = fs.readdirSync(target.cwd).filter( name => name.toLowerCase().endsWith('.pro') )
            if (pros.length > 0) {
                pro = pros[0]
            }
        }
        target.pro = pro
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

function updateMakeStat(targets, makeStat) {
    var modes = ['debug','release']
    targets.forEach(target => {
        target['makeTime'] = {}
        target['makeCode'] = {}
        modes.forEach( mode => {
            var stat = makeStat.get(target.cwd, mode)
            if (stat !== null) {
                target['makeTime'][mode] = stat.t
                target['makeCode'][mode] = stat.code
            } else {
                target['makeTime'][mode] = null
                target['makeCode'][mode] = null
            }
        }) 
    })
}

function readJson(name) {
    return fse.readJsonSync(path.join(__dirname,name))
}


module.exports = {isPathContains:isPathContains, findRoots:findRoots, findTarget:findTarget, 
    copyExampleMaybe:copyExampleMaybe, toCmdArgs:toCmdArgs, spawnDetached:spawnDetached, 
    guessPro:guessPro, updateMakeStat:updateMakeStat, readJson:readJson, getMtime:getMtime
}

