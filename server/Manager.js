
const {findRoots2, isPathContains, sortedPaths, findTarget, findTarget2} = require('./Utils')
const debug = require('debug')('cpp-compile-on-save')
const fs = require('fs')
const path = require('path')
var watch = require('node-watch')

class Manager {
    constructor(taskQueue) {
        this._taskQueue = taskQueue
        this._watched = []
        
    }

    onEvent(root,filename) {
        //debug('onEvent',root,filename)
        let basename = path.basename(filename)
        let ext = path.extname(basename)
        let absFileName = path.join(root,filename)
        let sourceExts = new Set(['.ui','.cpp','.h','.pro'])
        let binaryExts = new Set(['.dll','.exe'])

        let taskQueue = this._taskQueue

        if (basename.match(/moc_|ui_|qrc_|version[.]h/)) {
            return
        } else if (binaryExts.has(ext)) {
            taskQueue.emit('binary-changed',absFileName)
        } else if (sourceExts.has(ext)) {
            /*if (!config.active) {
                return
            }*/
            /*let doNotWatch = path.join(root,'.do-not-watch')
            if (fs.existsSync(doNotWatch)) {
                debug(`${doNotWatch} exists`)
                return
            } */
            //debug('QtCppWatcher.handle cpp|h',filename)
            let target = findTarget2(this._config,absFileName)

            //console.log('findTarget2',target)

            //console.log('mode',this._mode)

            //debug(`filename ${filename} target ${target} absFileName ${absFileName}`)
            let task = {cmd:'make',mode:this._mode,cwd:target.cwd,kill:target.kill,name:target.name}
            taskQueue.add(task,false,target)
        }

    }

    update(config, mode) {

        //return

        this._config = config
        this._mode = mode

        let roots = findRoots2(config.targets.items.map(item => item.cwd))

        //console.log('roots',roots)

        let roots_ = []
        roots.forEach(root => {
            if (!isPathContains(this._watched, root) && !isPathContains(roots_, root)) {
                roots_.push(root)
            }
        })

        roots_.forEach(root => {
            debug(`watch ${root}`)

            if (process.platform === 'linux') {
                watch(root, {recursive:true},(event,filename) => {
                    //debug('event, filename',event,filename)
                    if (filename !== null && (event === 'change' || event === 'rename' || event === 'update')) {
                        this.onEvent(root, filename)
                    }
                })
            } else {
                fs.watch(root,{recursive:true},(event,filename) => {
                    if (filename !== null && (event === 'change' || event === 'rename')) {
                        this.onEvent(root, filename)
                    }
                })
            }
            this._watched.push(root)
        })


    }
}

module.exports = Manager