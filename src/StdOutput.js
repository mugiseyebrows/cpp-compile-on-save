
import React, {Component} from 'react'

export default class StdOutput extends Component {

    shouldComponentUpdate(nextProps, nextState) {
      return nextProps.update !== this.props.update
    }
    
    render() {
      let props = this.props
      let {lines, showEmpty, key_, cmd, cwd, mode} = this.props
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
            console.log('item.t',item.t)
            return null
          })
          return <li key={i}>{items}</li>
      })

      return <ul className="proc-data" key={key_}><li key="-1" className="proc-title">{cmd} {mode} @ {cwd}</li>{data}</ul>
    }
  }