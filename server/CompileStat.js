
class CompileStat {

    constructor() {
        this.stat = []
    }

    set(cwd,mode,code,t) {
        var items = this.stat.filter( item => item.cwd == cwd && item.mode == mode )
        if (items.length > 0) {
            items[0].code = code;
            items[0].t = t;
        } else {
            this.stat.push({cwd:cwd,mode:mode,code:code,t:t})
        }
    }

    get(cwd,mode) {
        var items = this.stat.filter( item => item.cwd == cwd && item.mode == mode )
        if (items.length > 0) {
            return items[0]
        }
        return null;
    }

   
}

module.exports = CompileStat