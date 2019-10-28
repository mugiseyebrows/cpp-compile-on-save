
import React, {Component} from 'react'

export default class StdOutput extends Component {

    shouldComponentUpdate(nextProps, nextState) {
      return nextProps.update !== this.props.update
    }
    
    render() {
      
      //console.log('StdOutput.render')

      let props = this.props
      let {lines, showEmpty, key_, cmd, cwd, mode, refPane} = this.props

      //console.log(refPane && refPane.current)
      if (refPane !== undefined) {
        setTimeout(()=>{
          let e = refPane.current
          e.scrollTop = e.scrollHeight
        },10)
      }

      if (showEmpty === false && lines.length === 0) {
        return null
      }
      let data = lines.map((line,i) => {
          let items = line.map((item,j) => {
            //console.log('subitem',subitem)
            if (item.t === 't') {
              return <span key={j}>{item.v}</span>
            } else if (item.t === 'a') {
              return <a key={j} href="#" onClick={(e) => {e.preventDefault(); props.onAnchor(item)}}>{item.path}</a>
            }
            //console.log('item.t',item.t)
            return null
          })
          return <li key={i}>{items}</li>
      })
      let caption = cmd === 'make' ? `${cmd} ${mode} @ ${cwd}` : `${cmd} @ ${cwd}`
      return <ul className="proc-data" key={key_}><li key="-1" className="proc-title">{caption}</li>{data}</ul>
    }
  }