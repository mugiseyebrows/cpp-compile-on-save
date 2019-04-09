import React, { Component } from 'react'

/*
export default class CheckBoxWithLabel extends Component {

  render() {
    const { label, checked, onChange, className } = this.props;

    console.log('CheckBoxWithLabel',checked,onChange)

    return (
        <label className={className} ><input
            type="checkbox"
            value={label}
            checked={checked}
            onChange={(e) => {e.preventDefault(); onChange(e.target.checked)}}/>{label}</label>
    );
  }
}
*/

export default function CheckBoxWithLabel(props) {
  let onChange = (e) => {
      let checked = e.target.checked
      props.onChange(checked)
  }
  return <label key={props.key_}><input type="checkbox" name={props.name} checked={props.checked} onChange={onChange}/>{props.label}</label>
}



/*
Checkbox.propTypes = {
  label: PropTypes.string.isRequired,
  onChange: PropTypes.func.isRequired
};*/