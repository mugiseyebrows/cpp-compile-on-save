import React, { Component } from 'react'

// not used

export default class Input extends Component {
    render() {
        let {value, onChange, id} = this.props
        //console.log('Input',value, onChange)
        return <input type="text" id={id} value={value} onChange={(e) => onChange(e.target.value)}/>
    }
}