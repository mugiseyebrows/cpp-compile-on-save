import React, { Component } from 'react'

import './App.css'
import './FlexPane.css'
import {FlexPane, FlexPaneContainer} from './FlexPane'
import io from 'socket.io-client'
import classNames from "classnames"
import CheckBox from './CheckBox'
import Select from 'react-select'

import {mtimeFromNow, putLinks} from './Utils'

class App extends Component {

  constructor() {
    super()
    this.state = {
      stdout: [],
      stderr: [],
      errors: [],
      targets: [],
      tasks: [],
      isActive: true,
      mode: {value:'debug',label:'debug'}
    }

    this.refStdout = React.createRef()
    this.refStderr = React.createRef()

    const socket = io('http://localhost:4000')

    socket.on('proc-stdout',(obj) => {
      var stdout = this.state.stdout

      if (stdout.length === 0) {
        return
      }

      stdout[stdout.length-1].data = stdout[stdout.length-1].data + obj.data
      this.setState({stdout:stdout})
    })

    socket.on('proc-stderr',(obj) => {
      var stderr = this.state.stderr
      var errors = this.state.errors

      if (stderr.length === 0) {
        return
      }

      stderr[stderr.length-1].data = stderr[stderr.length-1].data + obj.data
      
      var lines = obj.data.toString().split('\r\n')

      lines.filter( line => 
          line.indexOf('error:') > -1 || 
          line.indexOf('cannot open output') > -1 ||
          line.indexOf('multiple definition') > -1 || 
          line.indexOf('first defined here') > -1 ||
          line.indexOf('undefined reference') > -1 ||
          line.indexOf('No rule to make target') > -1
      ).forEach( line => errors[errors.length-1].data.push(line) )

      this.setState({stderr:stderr,errors:errors})

    })

    socket.on('proc-start',(obj)=>{
      //this.setState({cwd:cwd})

      var {cwd,mode,cmd} = obj

      var {stdout,stderr,errors} = this.state
      stdout = stdout.filter( item => !(item.cwd === cwd && item.mode === mode && item.cmd === cmd) ).slice(-5)
      stderr = stderr.filter( item => !(item.cwd === cwd && item.mode === mode && item.cmd === cmd) ).slice(-5)
      errors = errors.filter( item => !(item.cwd === cwd && item.mode === mode && item.cmd === cmd) ).slice(-5)

      stdout.push({cwd:cwd,mode:mode,cmd:cmd,data:''})
      stderr.push({cwd:cwd,mode:mode,cmd:cmd,data:''})
      errors.push({cwd:cwd,mode:mode,cmd:cmd,data:[]})

      this.setState({stdout:stdout,stderr:stderr,errors:errors})
    })

    socket.on('proc-exit',(cwd)=>{
      //this.setState({cwd:null})
      socket.emit('targets')
    })

    socket.on('targets',(targets) => {
      this.setState({targets:targets})
      //console.log(targets)
    })

    socket.on('tasks',(tasks) => {
      this.setState({tasks:tasks})
    })


    socket.on('binary-changed',(p) => {
      socket.emit('targets')
    })

    socket.on('bookmarks',(bookmarks) => {
      this.setState({bookmarks:bookmarks})
    })

    var isActive = this.state.isActive
    
    socket.emit('targets')

    socket.emit('bookmarks')
    
    socket.emit('set-active',isActive)

    socket.emit('set-mode', this.state.mode.value)

    this.socket = socket
  }

  handleActiveChange = (e) => {
    var isActive = this.state.isActive
    isActive = !isActive
    this.setState({isActive:isActive})
    this.socket.emit('set-active',isActive)
  }

  handleMakeAll = (mode) => {
    this.socket.emit('make-all',mode)
  }
  
  handleBookmark = (k) => {
    this.socket.emit('open-bookmark',k)
  }

  componentDidMount() {
    //console.log(this.refStdout,this.refStdout.current)
  }

  handleModeChange = (newValue) => {
    this.setState({mode:newValue})
    this.socket.emit('set-mode',newValue.value)
  }

  handleProjectCommand = (command, target, mode) => {
    this.socket.emit('project-command',{command:command,target:target, mode: mode})
  }

  handleOpenFile = (cwd, path, lineNum) => {
    //console.log('handleOpenFile', cwd, path, lineNum)
    this.socket.emit('open-file',{cwd:cwd, path:path, lineNum:lineNum})
  }

  render() {

    var stdout = []
    var stderr = []
    var errors = []
    this.state.stdout.forEach((item,i) => { 
      stdout.push(<div key={i*2} className="proc-title">{item.cmd} {item.mode} @ {item.cwd}</div>)
      let items = []
      //items = item.data.split('\r\n')
      items = putLinks(item.data, item.cwd, this.handleOpenFile)
      stdout.push(<ul key={i*2+1} className="proc-data">{items}</ul>)
    })
    this.state.stderr.forEach((item,i) => { 
      stderr.push(<div key={i*2} className="proc-title">{item.cmd} {item.mode} @ {item.cwd}</div>)
      let items = []
      //items = item.data.split('\r\n')
      items = putLinks(item.data, item.cwd, this.handleOpenFile)
      stderr.push(<ul key={i*2+1}>{items}</ul>)
    })

    let mode = this.state.mode.value

    this.state.errors.forEach((item,i) => {
      if (item.data.length > 0) {
        
        let children = putLinks(item.data.join('\r\n'), item.cwd, this.handleOpenFile)
        
        errors.push(<div key={i*2} className="proc-title">{item.cmd} {item.mode} @ {item.cwd}</div>)
        errors.push(<ul key={i*2+1} className="proc-data" >{children}</ul>)
      }
    })
    
    var targetsBody = this.state.targets.map( (target,i) => {
    
        let makeTime_ = mtimeFromNow(target.Mtime[mode])

        var makeTime = target.makeTime[mode] != null ? `${target.makeTime[mode] / 1000}` : ''
        var makeCode = target.makeCode[mode]

        return (<tr key={i} className={classNames({"compile-success":makeCode === 0, "compile-error":makeCode !== 0 && makeCode !== null})}>
              <td><a href="#" onClick={(e)=>{e.preventDefault(); this.handleProjectCommand('explore', target)}}> {target.name} </a></td>
              <td>{makeTime_}</td>
              <td>
                <button className="make-button" onClick={()=>this.handleProjectCommand('make', target, mode)}>make</button>
                <button className="make-button" onClick={()=>this.handleProjectCommand('make', target, 'clean')}>clean</button>

                <div className="dropdown">
                  <div>&nbsp;...&nbsp;</div>
                  <div className="dropdown-content">
                    <button className="make-button" onClick={()=>this.handleProjectCommand('edit',target)}>edit</button>
                    <button className="make-button" onClick={()=>this.handleProjectCommand('qmake',target)}>qmake</button>
                    <button className="make-button" onClick={()=>this.handleProjectCommand('gitk',target)}>gitk</button>
                    <button className="make-button" onClick={()=>this.handleProjectCommand('bash',target)}>bash</button>
                    <button className="make-button" onClick={()=>this.handleProjectCommand('explore',target)}>explore</button>
                  </div>
                </div>

              </td>
              <td>{makeTime}</td>
              </tr>)
    })

    var targetsHeader = <tr><th>name</th><th>made</th><th>make</th><th>make time</th></tr>

    var tasks = null

    if (this.state.tasks.length > 0) {
      var children = this.state.tasks.map( (task,i) => <li key={i}>{JSON.stringify(task).replace(/\\\\/g,'\\')}</li> );
      tasks = <ul className="tasks">{children}</ul>
    }

    var bookmarks = [];
    for(let k in this.state.bookmarks) {
      bookmarks.push(<button key={k} onClick={() => this.handleBookmark(k)}>{k}</button>)
    }

    setTimeout(()=>{
      /*this.refStdout.current.scrollTo(0,10000)
      this.refStderr.current.scrollTo(0,10000)*/

      let es = [this.refStdout.current, this.refStderr.current]
      es.forEach( e => e.scrollTop = e.scrollHeight )

    },10)

    var modeOptions = [{value:'debug',label:'debug'},{value:'release',label:'release'}]
    
    return (
      <div className="App">
        <FlexPaneContainer>
          <FlexPane title="targets" buttonsAfter={[
            <CheckBox label="active" isChecked={this.state.isActive} onChange={this.handleActiveChange} />,
            <div className="compile-label"> mode </div>,
            <Select className="react-select__wrap" classNamePrefix="react-select" value={this.state.mode} onChange={this.handleModeChange} options={modeOptions} />,
            <div className="compile-label"> all </div>,
            <button key="0" className="compile" onClick={() => this.handleMakeAll(mode)}>make</button>,
            <button key="1" className="compile" onClick={() => this.handleMakeAll('clean')}>clean</button>,
            ]} >
            
            <table className="targets">
              <thead>{targetsHeader}</thead>
              <tbody>{targetsBody}</tbody>
            </table>
            <ul className="bookmarks">
              {bookmarks}
            </ul>

          </FlexPane>
          <FlexPane title="tasks">
            {tasks}
          </FlexPane>
          <FlexPane title="errors">
            <div className="errors">{errors}</div>
          </FlexPane>
          <FlexPane title="stdout" refPane={this.refStdout} className="stdout" >
            {stdout}
          </FlexPane>
          <FlexPane title="stderr" refPane={this.refStderr} className="stderr" >
            {stderr}
          </FlexPane>
        </FlexPaneContainer>
      </div>
    )
  }
}

export default App;
