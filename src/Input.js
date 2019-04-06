import React, { Component } from 'react'

// not used

export default class Input extends Component {
    render() {
        let {value, onChange} = this.props
        //console.log('Input',value, onChange)
        return <input type="text" value={value} onChange={(e) => onChange(e.target.value)}/>
    }
}