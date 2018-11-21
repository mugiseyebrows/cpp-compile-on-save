
import React, { Component } from 'react'

export default class Select extends Component {
    render() {
  
      var selected = this.props.selected
      var selectedValue = null
  
      if (selected == null) {
        console.log("selected == null")
      } else if (typeof selected === 'string') {
        selectedValue = selected
      } else {
        selectedValue = selected.value
      }
  
      var options = this.props.options.map( e => {
        var props = {
          value: '',
        }
        var label = ''
        if (typeof e == 'string') {
          props.value = e
          label = e
        } else {
          props.value = e.value
          label = e.label
        }
        if (props.value === selectedValue) {
          props['selected'] = 'on'
        }
        return <option {...props}>{label}</option>
      })
      return <select className={this.props.className} onChange={this.props.onChange}>{options}</select>
    }
  }
  