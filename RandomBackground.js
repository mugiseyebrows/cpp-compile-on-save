const fs = require('fs')
const path = require('path')

function range(...args) {
    if (args.length === 3) {
        let [a,b,s] = args
        let result = []
        for(var i=a;i<b;i+=s) {
            result.push(i)
        }
        return result
    } else if (args.length === 2) {
        return range(...args,1)
    } else if (args.length === 1) {
        return range(0,...args,1)
    }
}

var n = 20
var t = range(n).map(e => `.c${e} {background: hsl(${Math.round(360*e/n)},100%,60%);}`).join('\n')
fs.writeFileSync(path.join(__dirname,'src','RandomBackground.css'),t)
