
import React from 'react'

function CheckBox(props) {
    let onChange = (e) => {
        let checked = e.target.checked
        props.onChange(checked)
    }
    return <label key={props.key_}><input type="checkbox" name={props.name} checked={props.checked} onChange={onChange}/>{props.name}</label>
}

export default function CheckBoxList(props) {
    
    let {items, checked, onChange} = props
    let checkBoxes = items.map((item,i) => <CheckBox key={i} key_={i} name={item} checked={checked.indexOf(item) > -1} onChange={(value)=>onChange(item,value)} />)
    return <React.Fragment>{checkBoxes}</React.Fragment>
}
