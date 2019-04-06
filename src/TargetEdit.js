import React, {Component} from 'react'
import Input from './Input'

function CheckBox(props) {
    let onChange = (e) => {
        let checked = e.target.checked
        props.onChange(checked)
    }
    return <label key={props.key_}><input type="checkbox" name={props.name} checked={props.checked} onChange={onChange}/>{props.name}</label>
}

class CheckBoxList extends Component {
    render() {
        let props = this.props
        let {items, checked, onChange} = props
        let checkBoxes = items.map((item,i) => <CheckBox key={i} key_={i} name={item} checked={checked.indexOf(item) > -1} onChange={(value)=>onChange(item,value)} />)
        return <React.Fragment>{checkBoxes}</React.Fragment>
    }
}

function isArray(v) {
    return Array.isArray(v)
}

export default class TargetEdit extends Component {
    constructor(props) {
        super(props)
        this.state = {
            all: ["foo","bar","baz"],
            checked: ["bar"]
        }
    }

    render() {
        let item = this.props.item
        let inputs = ['name','debug','release','cwd'].map((p,i) => { 
            return <div key={i}><label>{p}<Input key={i} value={item[p]} onChange={(value) => this.props.onChange(p,value)} /></label></div>
        })

        let envNames = this.props.envs.items.map(item => item.name)
        
        //let {onAddEnv,onRemoveEnv} = this.props

        let onCheckBoxChange = (name,value) => {
            //console.log('onChange',name, value)
            let checked = isArray(item.envs) ? item.envs : []
            if (value) {
                checked.push(name)
            } else {
                checked = checked.filter(item_ => item_ !== name)
            }
            this.props.onChange('envs',checked)
        }

        return <React.Fragment>{inputs} envs<CheckBoxList items={envNames} checked={isArray(item.envs) ? item.envs : []} onChange={onCheckBoxChange}/></React.Fragment> 
    }
}