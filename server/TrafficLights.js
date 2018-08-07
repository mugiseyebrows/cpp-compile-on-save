


var SerialPort = require('serialport')
var debug = require('debug')('server')

class TrafficLights {

    constructor(serialPort) {
        if (serialPort != null)  {
            this.port = new SerialPort(serialPort)
            debug(`${serialPort} open`)

        } else {
            this.port = {write:()=>{}}
        }
    }

    red() {
        this.port.write('r')
    }

    blue() {
        this.port.write('b')
    }

    green() {
        this.port.write('g')
    }

    none() {
        this.port.write('0')
    }

}

module.exports = TrafficLights