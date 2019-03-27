
import React, {Component} from 'react'

import randomBackground from './RandomBackground';

export default class StdOutput extends Component {

    shouldComponentUpdate(nextProps, nextState) {
      return nextProps.update !== this.props.update
    }
    render() {
      let props = this.props
      //console.log('StdOutput.render',props.cmd,props.mode,props.cwd)
      let data = props.lines.map((line,i) => {
          let items = line.map((item,j) => {
            //console.log('subitem',subitem)
            if (item.t === 't') {
              return <span key={j}>{item.v}</span>
            } else if (item.t === 'a') {
              return <a key={j} href="#" onClick={(e) => {e.preventDefault(); props.onAnchor(item)}}>{item.path}</a>
            }
          })
          return <li key={i}>{items}</li>
      })

      

      let props_ = {className:"proc-data"}
      //randomBackground(props_)

      return <ul {...props_}><li className="proc-title">{props.cmd} {props.mode} @ {props.cwd}</li>{data}</ul>
    }
  }