
import StdOutput from './StdOutput'
import React, {Component} from 'react'

export default class StdOutputs extends Component {
    render() {
        let {data,onAnchor} = this.props
        return data.map((item,j) => {
            let {cmd, cwd, mode, lines, update} = item
            let props = {cmd, cwd, mode, lines, update, onAnchor, key:j}
            return <StdOutput {...props}/>
        })
    }
}