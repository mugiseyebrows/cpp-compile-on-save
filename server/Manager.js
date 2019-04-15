
const {findRoots, isPathContains, findTarget, defaults, readJson, writeJson} = require('./Utils')
const debug = require('debug')('cpp-compile-on-save')
const fs = require('fs')
const path = require('path')
var watch = require('node-watch')

class Manager {

    constructor() {
        this._watched = []
        this._mode = 'debug'
        this._active = false
        this._path = path.join(__dirname,'..','config.json')
        let config = defaults({envs:{items:[{name:'default',path:'',mode:'replace'}], selected: 0},targets:{items:[], selected: 0},commands:{items:[], selected: 0},comName:'none'}, readJson(this._path))
        this._config = config
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

            if (!this._active) {
                //debug('!active')
                return
            }

            let target = findTarget(this._config,absFileName)

            let mode = this._mode
            let {cwd, kill, name} = target

            let task = {cmd:'make',mode,cwd,kill,name}
            taskQueue.add(task,false,target)
        }

    }

    get mode() {
        return this._mode
    }

    set mode(mode) {
        this._mode = mode
    }

    set active(active) {
        this._active = active
    }

    get active() {
        return this._active
    }

    get env() {
        return this._env
    }

    set env(env) {
        this._env = env
        this._taskQueue.env = env
    }

    init(mode, active, taskQueue, trafficLights) {
        this._mode = mode
        this._active = active
        this._taskQueue = taskQueue
        this._trafficLights = trafficLights
        taskQueue.config = this._config
        trafficLights.config = this._config
    }

    get config() {
        return this._config
    }

    saveConfig() {
        writeJson(this._path, this._config)
    }

    set config(config) {

        this._config = config
        this._taskQueue.config = config
        this._trafficLights.config = config
        
        let roots = findRoots(config.targets.items.map(item => item.cwd))

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