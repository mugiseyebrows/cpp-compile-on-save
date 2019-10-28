

const path = require('path')
const fs = require('fs')
const {spawn} = require('child_process')
const debug = require('debug')('cpp-compile-on-save')
const fse = require('fs-extra')

function isArray(v) {
    return Array.isArray(v)
}

function any(vs) {
    return vs.reduce((p,c)=> p || c, false)
}

function isPathContains(parent,child) {
    if (isArray(parent)) {
        return any(parent.map(p => isPathContains(p,child)))
    }
    var path_sep = /[\\/]/g
    let p = parent.split(path_sep)
    let c = child.split(path_sep)
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

function sortedPaths(paths, asc = true) {
    let [k1,k2] = asc ? [-1,1] : [1,-1]
    let paths_ = paths.slice()
    paths_.sort( (path1,path2) => pathDepth(path1) < pathDepth(path2) ? k1 : k2 )
    return paths_
}

function pathDepth(path) {
    const path_sep = /[\\/]/g
    return path.split(path_sep).length
}

function findRoots(paths) {
    let result = []
    var path_sep = /[\\/]/g
    paths = sortedPaths(paths)

    //debug('sorted paths',paths)

    paths.forEach(path => {
        
        if (!isPathContains(result,path) && path !== "") {
            result.push(path)
        }
    })
    return result
}

function findTarget(config,p) {
    let items =  config.targets.items.filter(item => isPathContains(item.cwd, p))

    //config.targets.items.map(item => console.log('isPathContains(p, item.cwd)',isPathContains(p, item.cwd),'p',p,'item.cwd',item.cwd))

    let depths = items.map(item => pathDepth(item.cwd))

    //console.log('findTarget items',items)

    return items[depths.indexOf(Math.max(...depths))]
}


function spawnDetached(cmd,args,opts) {
    args = args || []

    opts = defaults(opts, {detached: true, stdio: 'ignore'})
    //debug('spawnDetached', cmd, args)
    //debug('opts.env.PATH',opts.env.PATH,'cmd',cmd)
    //let path = opts.env.PATH
    
    if (process.platform === 'win32') {
        if (cmd === 'explorer') {
            let explorer = path.join(process.env.SystemRoot, 'explorer.exe')
            if (fs.existsSync(explorer)) {
                cmd = explorer
            }
        }
        if (cmd.match(/[.]dll$/)) {
            return
        }
    }

    let child = spawn(cmd,args,opts)
    child.unref()    

}

function getMtime(targets) {
    let modes = ['debug','release']
    let mtime = {}

    targets.items.forEach(target => {
        mtime[target.name] = {
            debug:null,
            release:null
        }
        modes.forEach(mode => {
            let p = target[mode]
            //console.log('getMtime',mode,p)
            if (p.length > 0 && fs.existsSync(p)) {
                mtime[target.name][mode] = fs.statSync(p).mtime
            }
        })
    })
    return mtime
}

function readJson(name) {
    if (fs.existsSync(name)) {
        return fse.readJsonSync(name)
    }
}

function writeJson(name,obj) {
    return fse.writeJSONSync(name,obj,{spaces:1})
}

function defaults(...objs) {
    return Object.assign({},...objs)
}

module.exports = {isPathContains, spawnDetached, 
    readJson, writeJson, findRoots, 
    findTarget, getMtime, defaults
}
