

import moment from 'moment'

export function findPath(text) {
  var m1 = text.match(/([A-Z][:][^ :]+)[.](cpp|h)/i)
  var m2 = text.match(/([^ :]+)[.](cpp|h)/i)
  if (m1) {
    return m1[1] + '.' + m1[2]
  } else if (m2) {
    return m2[1] + '.' + m2[2]
  }
  return null
}

export function mtimeFromNow(d) {
  return moment(d,"YYYY-MM-DDTHH:mm:ss.SSSZ").fromNow()
}

export function dateTime(d) {
  return moment(d,"YYYY-MM-DDTHH:mm:ss.SSSZ").format("DD-MM-YYYY HH:mm:ss")
}

export function randomBackground(props) {
  return {backgroundColor: `hsl(${Math.round(Math.random()*360)},100%,50%)`}
}

function toUnixPath(path) {
  return path.replace(/\\/g,'/').replace(/\/{2,}/,'/')
}

export function putLinks(text, cwd) {
  return text.split('\n').map((line,j) => {
    let res = []
    line = line.replace('\r','')
    let path = findPath(line) 
    while (path !== null) {
      let parts = line.split(path,2)
      res.push({t:'t',v:parts[0]})
      let m = parts[1].match(/^[:]([0-9]+)[:]([0-9]+)/) || parts[1].match(/^[:]([0-9]+)/)
      let lineNum, colNum
      if (m) {
        lineNum = +m[1]
        colNum = +m[2]
      } 
      res.push({t:'a',cwd,path:toUnixPath(path),line:lineNum,col:colNum})
      line = parts[1]
      path = findPath(line)
    }
    res.push({t:'t',v:line})
    return res
  })
}

export function defaults(...objs) {
  return Object.assign({},...objs)
}