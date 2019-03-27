import classNames from "classnames"

export default function randomBackground(props) {
    let c = 'c' + Math.floor(Math.random()*20);
    if (props.className) {
        props.className = classNames(props.className,c)
    }
}