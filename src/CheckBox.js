import React, { Component, PropTypes } from 'react';

export default class Checkbox extends Component {


  render() {
    const { label, isChecked, onChange, id } = this.props;

    return (
      <div className="checkbox">
        <label ><input
            type="checkbox"
            value={label}
            checked={isChecked}
            onChange={onChange}/>{label}</label></div>
    );
  }
}



/*
Checkbox.propTypes = {
  label: PropTypes.string.isRequired,
  onChange: PropTypes.func.isRequired
};*/