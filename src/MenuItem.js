import React from 'react'
import classNames from "classnames"

export default function MenuItem(props) {
    let children = React.Children.toArray(props.children)
    let classNames_ = classNames("menu-item",props.className)
  
    let onClick
    if (props.onClick) {
      onClick = (e) => {e.preventDefault(); props.onClick()}
    }
  
    return <div className={classNames_} onClick={onClick} >{props.text}{children}</div>
  }
  