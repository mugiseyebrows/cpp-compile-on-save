
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
  
    if (text.split == null) {
      console.log('putLinks error',text)
    }
  
    var items = text.split('\r\n').map((line,j) => {
      
      var res = []
  
      let path = findPath(line) 
      while (path !== null) {
        var parts = line.split(path,2)
        res.push(parts[0])
        var m = parts[1].match(/^[:]([0-9]+)/)
        var lineNum = null
        if (m) {
          lineNum = m[1]
        } 
        let path_ = path
        res.push(<a key={res.length} href="#" onClick={(e) => {e.preventDefault(); fn(cwd, path_, lineNum)}}>{path}</a>)
        line = parts[1]
        path = findPath(line)
      }
      res.push(line)
  
      return <li key={j}>{res}</li>
    })
  
    return items
  }