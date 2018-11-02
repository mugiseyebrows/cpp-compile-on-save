import React, { Component } from 'react'

import './FlexPane.css'
import {FlexPane, FlexPaneContainer} from './FlexPane'
import io from 'socket.io-client'
import classNames from "classnames"
import CheckBox from './CheckBox'
import Select from 'react-select'

import Star from './star.svg'

import {mtimeFromNow, putLinks} from './Utils'

import MugiMenu from 'react-mugimenu'

import './App.css'

class Input extends Component {
  constructor(props) {
    super(props)
  }
  render() {
    return <input type="text" value={this.props.value} onChange={(e) => this.props.handleChange(e)}/>
  }
}

class App extends Component {

  constructor() {
    super()
    this.state = {
      stdout: [],
      stderr: [],
      errors: [],
      targets: [],
      tasks: null,
      isActive: false,
      mode: {value:'',label:''},

      made : {},
      mtime: {},
      commands: [],
      extraCommands: [],
      bookmarks: {commands:[],exec:{}},
      modeSelect: false,
      targetsVisibility: {}
    }

    this.refStdout = React.createRef()
    this.refStderr = React.createRef()

    const socket = io('http://localhost:4000')
    this.socket = socket

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
          line.indexOf('Permission denied') > -1 ||
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
      socket.emit('targets')
    })

    socket.on('targets',(targets) => {
      if (this.state.targets.length == 0) {
        var targetsVisibility = {}
        targets.forEach(target => {
          targetsVisibility[target.name] = true
        })
        this.setState({targetsVisibility:targetsVisibility})
      }
      this.setState({targets:targets})
    })

    socket.on('tasks',(tasks) => {
      this.setState({tasks:tasks})
    })

    socket.on('binary-changed',(p) => {
      socket.emit('mtime')
    })

    socket.on('mtime',(mtime)=>{
      this.setState({mtime:mtime})
      this.updateMade()
    })

    socket.on('bookmarks',(bookmarks) => {
      this.setState({bookmarks:bookmarks})
    })
    
    socket.on('is-active', (isActive) => {
      this.setState({isActive:isActive})
    })

    socket.on('get-mode',(mode)=>{
      var mode_ = {value:mode, label:mode}
      this.setState({mode:mode_})
    })

    socket.on('commands',({commands,extraCommands}) => {
      this.setState({commands:commands,extraCommands:extraCommands})
    })

    var reqs = ['targets','mtime','bookmarks','is-active','get-mode','commands']

    reqs.forEach(req => this.emit(req))

    setInterval(()=>{
      this.updateMade()
    },60000)

  }

  emit = (name, data) => {
    if (this.socket !== null) {
      this.socket.emit(name,data)
    }
  }

  updateMade = () => {
    var made = {}
    var mtime = this.state.mtime
    var modes = ['debug','release']

    this.state.targets.forEach(target => {
      made[target.name] = {debug:null,release:null}
      modes.forEach(mode => {
        if (mtime[target.name] && mtime[target.name][mode]) {
          made[target.name][mode] = mtimeFromNow(mtime[target.name][mode])
        }
      })
    })

    this.setState({made:made})
  }

  handleActiveChange = (e) => {
    var isActive = this.state.isActive
    isActive = !isActive
    this.setState({isActive:isActive})
    this.emit('set-active',isActive)
  }

  toggleModeSelect = () => {
    this.setState({modeSelect:!this.state.modeSelect})
  }

  handleEditOrSelectTargets = (name) => {
    if (name == 'edit') {
      this.emit('edit-targets')
    }
  }

  handleMakeAll = (mode) => {
    this.state.targets
      .filter((target,i) => this.state.targetsVisibility[target.name])
      .forEach(target => this.handleProjectCommand('make', target, mode))
  }
  
  handleBookmark = (k) => {
    this.emit('open-bookmark',k)
  }

  handleModeChange = (newValue) => {
    //this.setState({mode:newValue})
    this.emit('set-mode', newValue.value)
  }

  handleProjectCommand = (command, target, mode) => {
    this.emit('project-command',{command:command,target:target, mode: mode})
  }

  handleOpenFile = (cwd, path, lineNum) => {
    //console.log('handleOpenFile', cwd, path, lineNum)
    this.emit('open-file',{cwd:cwd, path:path, lineNum:lineNum})
  }


  handleClean = (subj) => {
    var x = {
      'errors': () => {this.setState({errors:[]})},
      'stdout': () => {this.setState({stdout:[]})},
      'stderr': () => {this.setState({stderr:[]})}
    }
    if (x[subj] != null) {
      x[subj]()
    }
  }

  handleTaskMenuClick = (name) => {
    if (['abort','cancel'].indexOf(name) > -1) {
      this.emit(name)
    } else {
      console.log('handleAbortAndCancel error',name)
    }
  }

  handleFilterInclude = (e) => {
    this.setState({targetsInclude:e.target.value})
  }

  handleFilterExclude = (e) => {
    this.setState({targetsExclude:e.target.value})
  }

  renderStdout = () => {
    var stdout = []
    this.state.stdout.forEach((item,i) => { 
      stdout.push(<div key={i*2} className="proc-title">{item.cmd} {item.mode} @ {item.cwd}</div>)
      let items = []
      //items = item.data.split('\r\n')
      items = putLinks(item.data, item.cwd, this.handleOpenFile)
      stdout.push(<ul key={i*2+1} className="proc-data">{items}</ul>)
    })
    return stdout
  }

  renderStderr = () => {
    var stderr = []
    this.state.stderr.forEach((item,i) => { 
      stderr.push(<div key={i*2} className="proc-title">{item.cmd} {item.mode} @ {item.cwd}</div>)
      let items = []
      //items = item.data.split('\r\n')
      items = putLinks(item.data, item.cwd, this.handleOpenFile)
      stderr.push(<ul key={i*2+1}>{items}</ul>)
    })
    return stderr
  }

  renderErrors = () => {
    var errors = []
    this.state.errors.forEach((item,i) => {
      if (item.data.length > 0) {
        
        let children = putLinks(item.data.join('\r\n'), item.cwd, this.handleOpenFile)
        
        errors.push(<div key={i*2} className="proc-title">{item.cmd} {item.mode} @ {item.cwd}</div>)
        errors.push(<ul key={i*2+1} className="proc-data" >{children}</ul>)
      }
    })
    return errors
  }

  handleAllNone = (name) => {
    let targetsVisibility = this.state.targetsVisibility
    for(let k in targetsVisibility) {
      targetsVisibility[k] = name === 'all' ? true : false
    }
    this.setState({targetsVisibility:targetsVisibility})
  }

  /*
  handleShowHideTarget = (i) => {
    var targetsVisibility = this.state.targetsVisibility
    targetsVisibility[i] = !targetsVisibility[i]
    this.setState({targetsVisibility:targetsVisibility})
  }*/

  handleModeSelect = (name) => {
    if (name == 'name') {
      this.toggleModeSelect()
    } else {
      this.handleAllNone(name)
    }
  }

  toggleVisibility = (target) => {
    let targetsVisibility = this.state.targetsVisibility
    targetsVisibility[target.name] = !targetsVisibility[target.name]
    this.setState({targetsVisibility:targetsVisibility})
  }

  handleExploreOrCheck = (target,i) => {
    if (this.state.modeSelect) {
      this.toggleVisibility(target)
    } else {
      this.handleProjectCommand('explore', target)
    }
  }

  renderTarget = (target,i) => {

    let mode = this.state.mode.value
    let modeSelect = this.state.modeSelect

    let makeTime = target.makeTime[mode] != null ? `${target.makeTime[mode] / 1000}` : ''
    let makeCode = target.makeCode[mode]

    let isChecked = this.state.targetsVisibility[target.name]
    
    let hidden = modeSelect ? false : !isChecked
    
    var rowClasses = classNames({
      "hidden": hidden,
      "compile-success": makeCode === 0, 
      "compile-error": makeCode !== 0 && makeCode !== null
    })

    let made
    if (this.state.made[target.name] && this.state.made[target.name][mode]) {
      made = this.state.made[target.name][mode]
    }

    var menuItems = this.state.commands.map(command=> command.name)
    menuItems.push({
      name: '...',
      children: this.state.extraCommands.map(command=> command.name)
    })

    return (<tr key={i} className={rowClasses}>
          <td>
            <CheckBox className={classNames("target-show-hide",{"hidden":!modeSelect})} onChange={(e) => this.toggleVisibility(target)} isChecked={isChecked} />
            <MugiMenu className="target-name" items={[target.name]} onItemClick={() => this.handleExploreOrCheck(target,i)} />
          </td>
          <td>{made}</td>
          <td class="target-menu">
            <MugiMenu items={menuItems} onItemClick={(name)=>this.handleProjectCommand(name, target, mode)}/>
          </td>
          <td>{makeTime}</td>
          </tr>)
  }

  renderTargets = () => {

    var modeSelect = this.state.modeSelect
    var targetsHeader = <tr><th> <MugiMenu items={modeSelect ? ['name','all','none'] : ['name']} onItemClick={(name)=>{this.handleModeSelect(name)}}/> </th><th>made</th><th>make</th><th>make time</th></tr>
    var targetsBody = this.state.targets.map((target,i) => this.renderTarget(target,i))
    return (<table className="targets">
              <thead>{targetsHeader}</thead>
              <tbody>{targetsBody}</tbody>
            </table>)
  }

  renderTasks = () => {
    
    if (this.state.tasks === null) {
      return null
    }

    var queued = this.state.tasks.queued
    var running = this.state.tasks.running

    if (queued.length === 0 && running === null) {
      return null
    }

    var queued_ = queued.map( (task,i) => <li key={i+1}>{JSON.stringify(task).replace(/\\\\/g,'\\')}</li> );

    var running_ = null
    if (running != null) {
      running_ = <li key={0} className="task-running">{JSON.stringify(running).replace(/\\\\/g,'\\')}</li>
    }

    return <ul className="tasks">{running_}{queued_}</ul>
  }

  scrollStdOutAndStdErr = () => {
    setTimeout(()=>{
      let es = [this.refStdout.current, this.refStderr.current]
      es.forEach( e => e.scrollTop = e.scrollHeight )
    },10)
  }

  handleMainMenu = (name) => {
    if (name == 'make') {
      this.handleMakeAll(this.state.mode.value)
    } else if (name == 'clean') {
      this.handleMakeAll('clean')
    } else {
      this.state.bookmarks.commands.forEach((command,i) => {
        if (command.name === name) {
          this.handleBookmark(command)
        }
      })
    }
  }

  render() {

    let stdout = this.renderStdout()
    let stderr = this.renderStderr()
    let errors = this.renderErrors()
    let targets = this.renderTargets()
    let tasks = this.renderTasks()
    //let bookmarks = this.renderBookmarks()
    this.scrollStdOutAndStdErr()
    let modeOptions = [{value:'debug',label:'debug'},{value:'release',label:'release'}]

    let mainMenuItems = ['make','clean',{name:'bookmarks',icon:Star,children:this.state.bookmarks.commands.map(command=>command.name)}]

    return (
      <div className="App">
        <FlexPaneContainer>
          <FlexPane title="targets" buttonsAfter={[
            <MugiMenu items={['edit']} onItemClick={(name) => this.handleEditOrSelectTargets(name)} />,
            <CheckBox label="active" isChecked={this.state.isActive} onChange={this.handleActiveChange} />,
            /*<div className="compile-label"> mode </div>,*/
            <Select className="react-select__wrap" classNamePrefix="react-select" value={this.state.mode} onChange={this.handleModeChange} options={modeOptions} />,
            /*<div className="compile-label"> all </div>,*/
            <MugiMenu items={mainMenuItems} onItemClick={(name) => this.handleMainMenu(name)} />,
          ]}>
          {targets}
          
          </FlexPane>
          <FlexPane title="tasks" buttonsAfter={[
            <MugiMenu items={['abort','cancel']} onItemClick={(name) => this.handleTaskMenuClick(name)}/>
            ]}>
            {tasks}
          </FlexPane>
          <FlexPane title="errors" buttonsAfter={[
            <MugiMenu items={['clean']} onItemClick={() => this.handleClean('errors')}/>
          ]}>
            <div className="errors">{errors}</div>
          </FlexPane>
          <FlexPane title="stdout" refPane={this.refStdout} className="stdout" buttonsAfter={[
            <MugiMenu items={['clean']} onItemClick={() => this.handleClean('stdout')}/>
          ]}>
            {stdout}
          </FlexPane>
          <FlexPane title="stderr" refPane={this.refStderr} className="stderr" buttonsAfter={[
            <MugiMenu items={['clean']} onItemClick={() => this.handleClean('stderr')}/>
          ]}>
            {stderr}
          </FlexPane>
        </FlexPaneContainer>
      </div>
    )
  }
}

export default App;
