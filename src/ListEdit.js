
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
      let {items,selected,editor,onSelect,onAdd,onRemove} = props
      let items_ = items ? items.map((item,i) => {
        let className = classNames("list-edit-item",{"list-edit-item-selected":selected === i})
        let removeButton = selected === i ? <button className="list-edit-remove-button" onClick={() => onRemove(selected)} >remove</button> : null
        return <div key={i} className={className} onClick={() => onSelect(i)}>{item.name}{removeButton}</div>
      }) : null
      let editor_ = (items && items[selected]) ? editor(items[selected]) : null
      
      /*if (items && items.length > 0) {
        console.log(items[selected])
      }*/

      let onAddClick = () => {
        onAdd(this.state.value)
        this.setState({value:''})
      }

      let onInputKeyDown = (e) => {
        if (e.key === 'Enter') {
          onAddClick()
        }
      }

      return (<div className="list-edit-wrapper">
              {this.props.title}
              <div className="list-edit-items">{items_}</div>
              <div className="list-edit-add-button-wrap">
                <Input value={this.state.value} onChange={(value)=>{this.setState({value})}} onKeyDown={onInputKeyDown} />
                <button className="list-item-add-button" onClick={onAddClick}>add</button>  
              </div> 
              <div className="list-edit-editor">{editor_}</div>
              </div>)
    }
  }
  