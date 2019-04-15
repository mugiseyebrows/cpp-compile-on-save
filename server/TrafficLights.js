


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
        if (config.comName !== 'none' && config.comName !== undefined) {
            this.open(config.comName)
        }
    }

    open(name) {
        if (this._name === name) {
            return
        }
        this._name = name
        if (this._port && this._port.isOpen) {
            this._port.close(showError)
        }
        debug('TrafficLights.open',name)
        this._port = new SerialPort(name,showError)
    }

    red() {
        this._port && this._port.write('r')
    }

    blue() {
        this._port && this._port.write('b')
    }

    green() {
        this._port && this._port.write('g')
    }

    none() {
        this._port && this._port.write('0')
    }

    static comNames() {
        return new Promise((resolve,reject)=>{
            SerialPort.Binding.list().then(ports => resolve(ports.map(port => port.comName)))
        })
    }

}

module.exports = TrafficLights