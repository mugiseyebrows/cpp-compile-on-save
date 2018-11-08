const debug = require('debug')('cpp-compile-on-save')

class MakeStat {

    constructor() {
        this.stat = {}
    }

    _get(name) {
        if (this.stat[name] == null) {
            this.stat[name] = {
                debug: {code: null, t:null},
                release: {code: null, t:null},
            }
        }
        return this.stat[name]
    }

    set(name,mode,code,t) {
        var item = this._get(name)
        item[mode].code = code
        if (t != null) {
            item[mode].t = t
        }
        debug(this.stat)
    }

    get(name) {
        this._get(name)
        return this.stat[name]
    }

}

module.exports = MakeStat