
import StdOutput from './StdOutput'
import React, {Component} from 'react'

export default class StdOutputs extends Component {

    constructor(props) {
        super(props)
        this.ref = React.createRef()
    }    

    render() {

        //console.log('StdOutputs.render')
        
        let {data, onAnchor, showEmpty, refPane} = this.props

        return data.map((item,j) => {
            let {cmd, cwd, mode, lines, update} = item
            let props = {cmd, cwd, mode, lines, update, onAnchor, key:j, key_:j, showEmpty, refPane}
            return <StdOutput {...props}/>
        })
    }
}