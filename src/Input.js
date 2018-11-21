import React, { Component } from 'react'

// not used

export default class Input extends Component {
    render() {
        return <input type="text" value={this.props.value} onChange={(e) => this.props.handleChange(e)}/>
    }
}