import React, {Component} from 'react'
import Input from './Input'
import CheckBoxList from './CheckBoxList'
import TwoColumnTable from './TwoColumnTable'

function isArray(v) {
    return Array.isArray(v)
}

export default class TargetEdit extends Component {
    constructor(props) {
        super(props)
        this.state = {
            all: [],
            checked: []
        }
    }

    render() {
        let item = this.props.item

        let header = ['name','debug','release','cwd','pro','kill']

        let inputs = header.map((p,i) => { 
            return <Input key={i} value={item[p]} onChange={(value) => this.props.onChange(p,value)} />
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

        inputs.push(<div className="target-edit-envs"><CheckBoxList items={envNames} checked={isArray(item.envs) ? item.envs : []} onChange={onCheckBoxChange}/></div>)
        header.push('envs')

        inputs.push(<button onClick={() => this.props.onQtProject(item)}>qt</button>)

        return <TwoColumnTable items={inputs} labels={header} prefix="target-input-"/>
    }
}