
import StdOutput from './StdOutput'
import React, {Component} from 'react'

export default class StdOutputs extends Component {
    render() {
        let {data,onAnchor,showEmpty} = this.props
        return data.map((item,j) => {
            let {cmd, cwd, mode, lines, update} = item
            let props = {cmd, cwd, mode, lines, update, onAnchor, key:j, key_:j, showEmpty}
            return <StdOutput {...props}/>
        })
    }
}