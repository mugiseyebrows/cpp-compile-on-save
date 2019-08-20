


var SerialPort = require('serialport')
const debug = require('debug')('cpp-compile-on-save')

function showError(err) {
    if (err) {
        console.log(err)
    }
}

class TrafficLights {

    constructor() {
        
    }

    set config(config) {
        if (config.comName !== undefined) {
            this.open(config.comName)
        }
    }

    reset() {
        if (this._port && this._port.isOpen) {
            debug('TrafficLights.close')
            this._port.close(showError)
        }
        this._port = undefined
        this._name = 'none'
    }

    open(name) {
        if (this._name === name) {
            return
        }
        this.reset()
        this._name = name
        if (name === 'none') {
            return
        }
        debug('TrafficLights.open',name)
        this._port = new SerialPort(name,showError)
    }

    portWrite(d) {
        if (this._port) {
            this._port.write(d)
        }
    }

    red() {
        this.portWrite('r')
    }

    blue() {
        this.portWrite('b')
    }

    green() {
        this.portWrite('g')
    }

    none() {
        this.portWrite('0')
    }

    static comNames() {
        return new Promise((resolve,reject)=>{
            debug('TrafficLights.comNames')
            SerialPort.Binding.list().then(ports => resolve(ports.map(port => port.comName)))
        })
    }

}

module.exports = TrafficLights