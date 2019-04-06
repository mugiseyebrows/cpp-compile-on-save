
import React, {Component} from 'react'
import classNames from "classnames"
import Input from './Input'

export default class ListEdit extends Component {
    constructor(props) {
      super(props)
      this.state = {
        value: ''
      }
    }
    render() {
      let props = this.props
      let {items,selected,editor,onSelect, onAdd, onRemove} = props
      let items_ = items.map((item,i) => <div key={i} className={classNames("list-item",{"list-item-selected":selected === i})} onClick={()=>onSelect(i)}>{item.name}</div>)
      let editor_ = items.length > 0 ? editor(items[selected]) : null
      return (<React.Fragment>
              <div className="list-edit-items"  >{items_}</div>
              <Input value={this.state.value} onChange={(value)=>{this.setState({value})}}/>
              <button onClick={()=>{onAdd(this.state.value);this.setState({value:''})}}>add</button>
              <button onClick={()=>onRemove(selected)} >remove</button>
              <div className="list-edit-editor">{editor_}</div>
              {props.children}
              </React.Fragment>)
    }
  }
  