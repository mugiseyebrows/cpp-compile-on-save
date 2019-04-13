import React from 'react'

export default function TwoColumnTable(props) {
    let {labels, items, prefix} = props
    let rows = items.map((item,i) => {
        //console.log('item',item)

        //console.log('item',item,item.type.name)

        let typeNames = ['Input','Select']

        let label = (labels[i] && (item.type === 'input' || typeNames.indexOf(item.type.name) > -1)) ? <label htmlFor={prefix + i}>{labels[i]}</label> : labels[i]
        item = React.cloneElement(item, {id: prefix + i})
        return <tr key={i}><th>{label}</th><td>{item}</td></tr>
    })
    return <table><tbody>{rows}</tbody></table>
}
