
import React from 'react'
import moment from 'moment'

export function findPath(text) {
    var m1 = text.match(/([A-Z][:][^ :]+)[.](cpp|h)/)
    var m2 = text.match(/([^ :]+)[.](cpp|h)/)
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
  
  export function putLinks(text, cwd, fn) {
  
    var items = text.split('\n').map((line,j) => {
      
      line = line.replace('\r','')

      var res = []
  
      let path = findPath(line) 
      while (path !== null) {
        let parts = line.split(path,2)
        res.push(parts[0])
        let m = parts[1].match(/^[:]([0-9]+)[:]([0-9]+)/) || parts[1].match(/^[:]([0-9]+)/)
        let lineNum, colNum
        if (m) {
          lineNum = +m[1]
          colNum = +m[2]
        } 
        let path_ = path
        res.push(<a key={res.length} href="#" onClick={(e) => {e.preventDefault(); fn({cwd,path:path_,lineNum,colNum})}}>{path}</a>)
        line = parts[1]
        path = findPath(line)
      }
      res.push(line)
  
      return <li key={j}>{res}</li>
    })
  
    return items
  }