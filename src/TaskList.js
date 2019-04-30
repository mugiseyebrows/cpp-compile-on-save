
import React from 'react'
import classNames from "classnames"

export default function TaskList(props) {
    var {queued, running} = props.tasks

    if (queued.length === 0 && running === null) {
      return null
    }

    let renderTask = (task,i,running) => {
      let caption = task.cmd === 'kill' ? `${task.cmd} ${task.proc}` : `${task.cmd} ${task.cmd === 'make' ? task.mode : ''} @ ${task.target.cwd}`
      return <li key={i} className={classNames({"task-running": running})}>{caption}</li>
    }

    return (<ul className="tasks">
              {running ? renderTask(running,-1,true) : null}
              {queued.map((task,i) => renderTask(task,i))}
            </ul>)
}