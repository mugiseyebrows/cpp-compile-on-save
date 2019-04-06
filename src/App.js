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

import StdOutputs from './StdOutputs'

import MugiMenu from 'react-mugimenu'

import Select from './Select'

import './App.css'
import Input from './Input'
import ListEdit from './ListEdit'
import TargetEdit from './TargetEdit'

function lastItem(vs) {
  return vs[vs.length-1]
}

let MenuItem = (props) => {
  let children = React.Children.toArray(props.children)
  let classNames_ = classNames("menu-item",props.className)

  let onClick
  if (props.onClick) {
    onClick = (e) => {e.preventDefault(); props.onClick()}
  }

  return <div className={classNames_} onClick={onClick} >{props.text}{children}</div>
}

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
      envs: {items:[{name:'foo',path:''},{name:'bar',path:''}],selected:0},
      targets2: {
        items: [],
        selected: 0,
      }
    }

    this.refStdout = React.createRef()
    this.refStderr = React.createRef()
    this.refErrors = React.createRef()

    this.socket = io('http://localhost:4000')

    let socket = this.socket


    let onstd = (name,obj) => {
      let out = this.state[name]
      if (out.length === 0) {
        console.log(`${name}.length === 0`)
        return
      }
      if (obj.cwd === lastItem(out).cwd) {
        putLinks(obj.data, obj.cwd).forEach(line => lastItem(out).lines.push(line))
        lastItem(out).update++
      } else {
        console.log(obj.cwd, lastItem(out).cwd)
      }
      this.setState({[name]:out})
    }

    socket.on('stdout',(obj) => {
      
      onstd('stdout',obj)
    })

    socket.on('stderr',(obj) => {
      onstd('stderr',obj)
      let lines = obj.data.toString().split('\r\n')
      let errors = this.state.errors

      if (errors.length === 0) {
        console.log('errors.length === 0')
        return
      }

      let msgs = [
        'error:',
        'cannot open output',
        'Permission denied',
        'multiple definition',
        'first defined here',
        'undefined reference',
        'No rule to make target'
      ]

      let errorLines = lines.filter( line => 
          Math.max(...msgs.map(msg => line.indexOf(msg))) > -1
      )

      if (errorLines.length === 0) {
        return
      }

      putLinks(errorLines.join('\n'), obj.cwd).forEach(line => lastItem(errors).lines.push(line))
      lastItem(errors).update++
      this.setState({errors:errors})

    })

    socket.on('proc-start',(obj)=>{
      //this.setState({cwd:cwd})

      var {cwd,mode,cmd} = obj

      var {stdout,stderr,errors} = this.state
      stdout = stdout.filter( item => !(item.cwd === cwd && item.mode === mode && item.cmd === cmd) ).slice(-5)
      stderr = stderr.filter( item => !(item.cwd === cwd && item.mode === mode && item.cmd === cmd) ).slice(-5)
      errors = errors.filter( item => !(item.cwd === cwd && item.mode === mode && item.cmd === cmd) ).slice(-5)

      stdout.push({cwd:cwd,mode:mode,cmd:cmd,lines:[],update:0})
      stderr.push({cwd:cwd,mode:mode,cmd:cmd,lines:[],update:0})
      errors.push({cwd:cwd,mode:mode,cmd:cmd,lines:[],update:0})

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

    socket.on('config',(config)=>{
      this.setState({envs:config.envs, targets2:config.targets})
    })

    var reqs = ['targets','mtime','bookmarks','is-active','get-mode','commands','make-stat','config']

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
    
    var {queued, running} = this.state.tasks

    if (queued.length === 0 && running === null) {
      return null
    }

    let renderTask = (task,i,running) => <li key={i} className={classNames({"task-running": running})} >{task.cmd} {task.mode} @ {task.cwd}</li>

    return (<ul className="tasks">
              {running ? renderTask(running,-1,true) : null}
              {queued.map((task,i) => renderTask(task,i))}
            </ul>)
  }

  scrollStdOutAndStdErr = () => {
    setTimeout(()=>{
      let es = [this.refStdout.current, this.refStderr.current, this.refErrors.current]
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

    let targets = this.renderTargets()
    let tasks = this.renderTasks()
    //let bookmarks = this.renderBookmarks()
    this.scrollStdOutAndStdErr()
   
    let bookmarks = this.state.bookmarks.map((bookmark,i) => <MenuItem key={i} text={bookmark.name} onClick={()=>this.handleBookmark(bookmark)}/>)

    //targets = null

    let envs = {
      items: this.state.envs.items,
      selected: this.state.envs.selected,
      editor: (item) => <label>Path<Input value={item.path} onChange={(value)=>{item.path = value; let envs = this.state.envs; this.setState({envs})}}/></label>,
      onSelect: (selected)=>{let envs = this.state.envs; envs.selected = selected; this.setState({envs})},
      onAdd: (value) => {
        let envs = this.state.envs
        let items = envs.items
        items.push({name:value,path:''})
        envs.selected = items.length-1
        this.setState({envs})
      },
      onRemove: (selected) => {let envs = this.state.envs; let items = envs.items; items.splice(selected,1); this.setState({envs})},
    }

    let targets2 = {
      items: this.state.targets2.items,
      selected: this.state.targets2.selected,
    editor: (item) => {

      //let onAddEnv = (name) => {let targets2 = this.state.targets2; item.envs.push(name);this.setState({targets2})}
      //let onRemoveEnv = (name) => {let targets2 = this.state.targets2; item.envs.splice(item.envs.indexOf(name),1);this.setState({targets2})}
      let onChange = (p,value)=>{let targets2 = this.state.targets2; item[p] = value;this.setState({targets2})}

      return <TargetEdit envs={this.state.envs} item={item} onChange={onChange}/>
    },
      onSelect: (selected) => {
        let targets2 = this.state.targets2
        targets2.selected = selected
        this.setState({targets2})
      },
      onAdd: (value) => {
        let targets2 = this.state.targets2
        targets2.items.push({name:value,debug:'',release:'',cwd:'',kill:[],envs:[]})
        targets2.selected = targets2.items.length - 1
        this.setState({targets2})
      },
      onRemove: (selected) => {
        let targets2 = this.state.targets2
        targets2.items.splice(selected,1)
        this.setState({targets2})
      }
    }

    //targets = null

    return (
      <div className="App">
        <FlexPaneContainer>
          <FlexPane title="targets">
            <FlexPaneBar className="top-menu">
              
                <FlexPaneButtons/>
                <FlexPaneTitle/>
                <MenuItem text="edit" onClick={()=>this.emit('edit-targets')}/>
                <MenuItem>
                  <CheckBox label="active" isChecked={this.state.isActive} onChange={this.handleActiveChange} />
                </MenuItem>
                <MenuItem>
                  <Select className="mode" options={[{value:'debug',label:'debug'},{value:'release',label:'release'}]} onChange={this.handleModeChange} selected={this.state.mode} />
                </MenuItem>
                <MenuItem className="menu-spacer"/>
                <MenuItem text="make" onClick={()=>{this.handleMakeAll(this.state.mode)}}/>
                <MenuItem text="clean" onClick={()=>{this.handleMakeAll('clean')}}/>
                <Popup trigger={<div className="menu-item"><img src={Star} alt="Star"/></div>} position="bottom right" on="hover" arrow={false} contentStyle={{width:'110px', textAlign: 'center', padding: '0px'}} >
                  <div>
                    {bookmarks}
                  </div>
                </Popup>
              
            </FlexPaneBar>
            {targets}

            <div style={{display:'none'}}>
            <ListEdit {...envs} >
            </ListEdit>
            

            <ListEdit {...targets2} >
              <button onClick={()=>{this.emit('setConfig',{envs:this.state.envs,targets:this.state.targets2})}} >save</button>
            </ListEdit>
            </div>

          </FlexPane>
          <FlexPane title="tasks">
            <FlexPaneBar>
              <FlexPaneButtons/>
              <FlexPaneTitle/>
              <MugiMenu items={['abort','cancel']} onItemClick={(name) => this.handleTaskMenuClick(name)}/>
            </FlexPaneBar>
            {tasks} 
          </FlexPane>
          <FlexPane title="errors" refPane={this.refErrors} className="errors">
            <FlexPaneBar>
              <FlexPaneButtons/>
              <FlexPaneTitle/>
              <MugiMenu items={['clean']} onItemClick={() => this.handleClean('errors')}/>
            </FlexPaneBar>
            <StdOutputs data={this.state.errors} onAnchor={this.handleOpenFile}/>
          </FlexPane>
          <FlexPane title="stdout" refPane={this.refStdout} className="stdout">
            <FlexPaneBar>
              <FlexPaneButtons/>
              <FlexPaneTitle/>
              <MugiMenu items={['clean']} onItemClick={() => this.handleClean('stdout')}/>
            </FlexPaneBar>
            <StdOutputs data={this.state.stdout} onAnchor={this.handleOpenFile}/>
          </FlexPane>
          <FlexPane title="stderr" refPane={this.refStderr} className="stderr">
            <FlexPaneBar>
              <FlexPaneButtons/>
              <FlexPaneTitle/>
              <MugiMenu items={['clean']} onItemClick={() => this.handleClean('stderr')}/>
            </FlexPaneBar>
            <StdOutputs data={this.state.stderr} onAnchor={this.handleOpenFile}/>
          </FlexPane>
        </FlexPaneContainer>
      </div>
    )
  }
}

export default App;
