import React, {Component} from 'react'
import {FlexPane, FlexPaneContainer, FlexPaneBar, FlexPaneButtons, FlexPaneTitle} from 'react-flexpane'
import 'react-flexpane/dist/styles.css'

import io from 'socket.io-client'
import classNames from "classnames"
import CheckBox from './CheckBox'
import Popup from "reactjs-popup";
//import Select from 'react-select'

import Star from './star.svg'

import {mtimeFromNow, putLinks} from './Utils'

import MugiMenu from 'react-mugimenu'

import Select from './Select'

import './App.css'

class App extends Component {

  constructor() {
    super()
    this.state = {
      stdout: [],
      stderr: [],
      errors: [],
      targets: [],
      tasks: {queued:[], running:null},
      isActive: false,
      mode: 'debug',

      made : {},
      mtime: {},
      commands: {shown:[],hidden:[]},
      bookmarks: [],
      modeSelect: false,
      targetsVisibility: {},
      makeStat: {},
    }

    this.refStdout = React.createRef()
    this.refStderr = React.createRef()

    this.socket = io('http://localhost:4000')

    let socket = this.socket

    socket.on('stdout',(obj) => {

      //return

      var stdout = this.state.stdout

      if (stdout.length === 0) {
        return
      }

      stdout[stdout.length-1].data = stdout[stdout.length-1].data + obj.data
      this.setState({stdout:stdout})
    })

    socket.on('stderr',(obj) => {
      //return

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
      if (this.state.targets.length === 0) {
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

    socket.on('make-stat',(makeStat)=>{
      this.setState({makeStat:makeStat})
    })

    socket.on('bookmarks',(bookmarks) => {
      this.setState({bookmarks:bookmarks})
    })
    
    socket.on('is-active', (isActive) => {
      this.setState({isActive:isActive})
    })

    socket.on('get-mode',(mode)=>{
      //console.log('get-mode',mode)
      this.setState({mode:mode})
    })

    socket.on('commands', commands => {
      this.setState({commands:commands})
    })

    var reqs = ['targets','mtime','bookmarks','is-active','get-mode','commands','make-stat']

    reqs.forEach(req => this.emit(req))

    setInterval(()=>{
      this.updateMade()
    },60000)

  }

  emit = (name, data) => {
    //if (this.socket !== undefined) {
      this.socket.emit(name,data)
    //}
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
    if (name === 'edit') {
      this.emit('edit-targets')
    }
  }

  handleMakeAll = (mode) => {
    this.state.targets
      .filter((target) => this.state.targetsVisibility[target.name])
      .forEach(target => this.handleProjectCommand('make', target, mode))
  }
  
  handleBookmark = (k) => {
    this.emit('open-bookmark',k)
  }

  handleProjectCommand = (command, target, mode) => {
    this.emit('project-command',{command:command,target:target, mode: mode})
  }

  handleOpenFile = (args) => {
    //console.log('handleOpenFile', cwd, path, lineNum)
    this.emit('open-file',args)
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

  handleModeSelect = (name) => {
    if (name === 'name') {
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

    let mode = this.state.mode
    let modeSelect = this.state.modeSelect

    let makeCode = null
    let makeTime = null
    if (this.state.makeStat && this.state.makeStat[target.name] && this.state.makeStat[target.name][mode]) {
      makeCode = this.state.makeStat[target.name][mode].code
      makeTime = this.state.makeStat[target.name][mode].t
      if (makeTime != null) {
        makeTime = makeTime / 1000
      }
    }

    let isChecked = this.state.targetsVisibility[target.name]
    
    let hiddenRow = modeSelect ? false : !isChecked
    
    var rowClasses = classNames({
      "hidden": hiddenRow,
      "compile-success": makeCode === 0, 
      "compile-error": makeCode !== 0 && makeCode !== null
    })

    let made
    if (this.state.made[target.name] && this.state.made[target.name][mode]) {
      made = this.state.made[target.name][mode]
    }

    var menuShown = this.state.commands.shown.map((command,i) => <div key={i} className="menu-item" onClick={() => this.handleProjectCommand(command.name, target, mode)}> {command.name}</div>)
    var menuHidden = this.state.commands.hidden.map((command,i) => <div key={i} className="menu-item" onClick={() => this.handleProjectCommand(command.name, target, mode)}> {command.name}</div>)
    
    return (<tr key={i} className={rowClasses}>
          <td>
            <CheckBox className={classNames("target-show-hide",{"hidden":!modeSelect})} onChange={() => this.toggleVisibility(target)} isChecked={isChecked} />
            <MugiMenu className="target-name" items={[target.name]} onItemClick={() => this.handleExploreOrCheck(target,i)} />
          </td>
          <td>{made}</td>
          <td className="menu-target">
            {menuShown}
            <Popup
              trigger={<div className="menu-item"> ... </div>}
              position="right top"
              on="hover"
              closeOnDocumentClick
              mouseLeaveDelay={0}
              mouseEnterDelay={0}
              contentStyle={{ padding: '0px', border: 'none', width: '80px', textAlign: 'center' }}
              arrow={false}>
              <div>
                {menuHidden}
              </div>
            </Popup>
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

    var {queued, running} = this.state.tasks

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
    if (name === 'make') {
      this.handleMakeAll(this.state.mode)
    } else if (name === 'clean') {
      this.handleMakeAll('clean')
    } else {
      this.state.bookmarks.forEach((bookmark,i) => {
        if (bookmark.name === name) {
          this.handleBookmark(bookmark)
        }
      })
    }
  }

  handleModeChange = (e) => {
    var value = e.target.value
    this.emit('set-mode', value)
    //this.setState({'mode':value})
  }

  render() {

    //console.log('render',+new Date())

    let stdout = this.renderStdout()
    let stderr = this.renderStderr()
    let errors = this.renderErrors()
    let targets = this.renderTargets()
    let tasks = this.renderTasks()
    //let bookmarks = this.renderBookmarks()
    this.scrollStdOutAndStdErr()
    let modeOptions = [{value:'debug',label:'debug'},{value:'release',label:'release'}]

    let mainMenuItems = ['make','clean',{name:'bookmarks',icon:Star,children:this.state.bookmarks.map(bookmark=>bookmark.name)}]

    return (
      <div className="App">
        <FlexPaneContainer>
          <FlexPane title="targets">
            <FlexPaneBar className="main-bar">
              <FlexPaneButtons/>
              <FlexPaneTitle/>
              <MugiMenu items={['edit']} onItemClick={(name) => this.handleEditOrSelectTargets(name)} />
              <CheckBox label="active" isChecked={this.state.isActive} onChange={this.handleActiveChange} />
              <Select className="mode" options={modeOptions} onChange={this.handleModeChange} selected={this.state.mode} />
              <div className="spacer"/>
              <MugiMenu items={mainMenuItems} onItemClick={(name) => this.handleMainMenu(name)} />
            </FlexPaneBar>
            {targets}
          </FlexPane>
          <FlexPane title="tasks">
            <FlexPaneBar>
              <FlexPaneButtons/>
              <FlexPaneTitle/>
              <MugiMenu items={['abort','cancel']} onItemClick={(name) => this.handleTaskMenuClick(name)}/>
            </FlexPaneBar>
            {tasks} 
          </FlexPane>
          <FlexPane title="errors">
            <FlexPaneBar>
              <FlexPaneButtons/>
              <FlexPaneTitle/>
              <MugiMenu items={['clean']} onItemClick={() => this.handleClean('errors')}/>
            </FlexPaneBar>
            <div className="errors">{errors}</div>
          </FlexPane>
          <FlexPane title="stdout" refPane={this.refStdout} className="stdout">
            <FlexPaneBar>
              <FlexPaneButtons/>
              <FlexPaneTitle/>
              <MugiMenu items={['clean']} onItemClick={() => this.handleClean('stdout')}/>
            </FlexPaneBar>
            {stdout}
          </FlexPane>
          <FlexPane title="stderr" refPane={this.refStderr} className="stderr">
            <FlexPaneBar>
              <FlexPaneButtons/>
              <FlexPaneTitle/>
              <MugiMenu items={['clean']} onItemClick={() => this.handleClean('stderr')}/>
            </FlexPaneBar>
            {stderr}
          </FlexPane>
        </FlexPaneContainer>
      </div>
    )
  }
}

export default App;
