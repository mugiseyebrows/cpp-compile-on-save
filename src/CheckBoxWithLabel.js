import React from 'react'

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