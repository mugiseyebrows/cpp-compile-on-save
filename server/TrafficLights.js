


var SerialPort = require('serialport')

class TrafficLights {

    constructor(port) {
        this.port = new SerialPort('COM6',{baudRate: 9600});
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