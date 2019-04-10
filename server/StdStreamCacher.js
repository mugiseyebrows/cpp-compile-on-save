const EventEmitter = require('events')

class StdStreamCacher extends EventEmitter {
    constructor() {
        super()
        this._chans = ['stdout','stderr']
        this.data = {}
        this._chans.forEach(chan => {
            this.data[chan] = {}
        })
        this.handle = setInterval(()=>{
            this.flush()
        },1000)
    }

    get chans() {
        return this._chans
    }

    listen(proc, cwd) {
        this._chans.forEach(chan => {
            proc[chan].on('data', data => {
                let text = data.toString()
                this.data[chan][cwd] = (this.data[chan][cwd] || '') + text
            })
        })
    }

    flush() {
        this._chans.forEach(chan => {
            for(let cwd in this.data[chan]) {
                let data = this.data[chan][cwd]
                if (data !== '' && data !== undefined) {
                    //debug('socket.emit',cwd)
                    this.emit(chan,{data,cwd})
                    delete this.data[chan][cwd] 
                }
            }
        })
    }
}

module.exports = StdStreamCacher