
import React, { Component } from 'react'

function isString(v) {
  return typeof v === 'string'
}

export default class Select extends Component {
    render() {
  
      var selected = this.props.selected
      var selectedValue = null
  
      if (selected === undefined) {
        console.log("selected === undefined")
      } else if (isString(selected)) {
        selectedValue = selected
      } else if (selected.value !== undefined) {
        selectedValue = selected.value
      } else {
        console.log(`unexpected selected prop ${selected}`)
      }
  
      var options = this.props.options.map( e => {
        var props = {
          value: '',
        }
        var label = ''
        if (isString(e)) {
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
  