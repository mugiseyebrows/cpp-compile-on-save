
const path = require('path')
const debug = require('debug')('cpp-compile-on-save')
const fs = require('fs')
const {findTarget} = require('./Utils')

class QtCppWatcher {
    constructor(config, targets, taskQueue) {
        this.config = config
        this.targets = targets
        this.taskQueue = taskQueue
    }
    handle(root, filename) {
        if (filename === null) {
            debug('filename is null',event)
            return
        }
       
        let basename = path.basename(filename)
        let ext = path.extname(basename)
        let absFileName = path.join(root,filename)
        let sourceExts = new Set(['.ui','.cpp','.h','.pro'])
        let binaryExts = new Set(['.dll','.exe'])
        let {config, targets, taskQueue} = this

        if (basename.match(/moc_|ui_|qrc_|version[.]h/)) {
            return
        } else if (binaryExts.has(ext)) {
            taskQueue.emit('binary-changed',absFileName)
        } else if (sourceExts.has(ext)) {
            if (!config.active) {
                return
            }
            let doNotWatch = path.join(root,'.do-not-watch')
            if (fs.existsSync(doNotWatch)) {
                debug(`${doNotWatch} exists`)
                return
            } 
            let target = findTarget(targets,absFileName)
            //debug(`filename ${filename} target ${target} absFileName ${absFileName}`)
            let task = {cmd:'make',mode:config.mode,cwd:target.cwd,kill:target.kill,name:target.name}
            taskQueue.add(task,false,target)
        }
        
    }
}

module.exports = QtCppWatcher