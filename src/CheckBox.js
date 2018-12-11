import React, { Component } from 'react'


export default class Checkbox extends Component {

  render() {
    const { label, isChecked, onChange } = this.props;

    return (
      
        <label className={this.props.className} ><input
            type="checkbox"
            value={label}
            checked={isChecked}
            onChange={onChange}/>{label}</label>
    );
  }
}



/*
Checkbox.propTypes = {
  label: PropTypes.string.isRequired,
  onChange: PropTypes.func.isRequired
};*/