import React from 'react'

export default function ProgressBar(props) {
    let props_ = Object.assign({},{minValue:0, maxValue:100, value:0, width: "100px", height: "10px"}, props)
    let {minValue, maxValue, value, width, height} = props_
    let progressWidth = ((value - minValue) / (maxValue - minValue) * 100) + '%'

    return <div style={{width, height, backgroundColor: "#e7e9ed"}}>
        <div style={{width: progressWidth, height: "100%", backgroundColor: "#5755d9"}}/>
    </div>
}
