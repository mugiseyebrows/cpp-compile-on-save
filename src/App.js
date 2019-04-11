import React, {Component} from 'react'
import {FlexPane, FlexPaneContainer, FlexPaneBar, FlexPaneButtons, FlexPaneTitle} from 'react-flexpane'
import 'react-flexpane/dist/styles.css'

import io from 'socket.io-client'
import classNames from "classnames"
import CheckBoxWithLabel from './CheckBoxWithLabel'
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
import TwoColumnsTable from './TwoColumnTable'

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
      tasks: {queued:[], running:null},
      active: false,
      mode: 'debug',
      made : {},
      mtime: {},
      makeStat: {},
      envs: {items: [], selected: 0},
      targets2: {items: [], selected: 0},
      commands2: {items: [], selected: 0}
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

    socket.on('tasks',(tasks) => {
      this.setState({tasks:tasks})
    })

    socket.on('binary-changed',(p) => {
      socket.emit('mtime')
    })

    socket.on('mtime',(mtime)=>{
      //console.log('mtime')
      this.setState({mtime:mtime})
      this.updateMade()
      //console.log('mtime')
    })

    socket.on('make-stat',(makeStat)=>{
      this.setState({makeStat:makeStat})
    })

    socket.on('bookmarks',(bookmarks) => {
      this.setState({bookmarks:bookmarks})
    })
    
    socket.on('active', (active) => {
      this.setState({active})
    })

    socket.on('get-mode',(mode)=>{
      //console.log('get-mode',mode)
      this.setState({mode:mode})
    })

    socket.on('config',(config)=>{
      this.setState({envs:config.envs, targets2:config.targets, commands2: config.commands})
      this.emitSetEnv()
      this.updateMade()
    })

    var reqs = ['targets','mtime','bookmarks','active','mode','make-stat','config']

    reqs.forEach(req => this.emit(req))

    setInterval(()=>{
      this.updateMade()
    },60000)

  }

  emit = (name, data) => {
    this.socket.emit(name,data)
  }

  updateMade = () => {
    
    var made = {}
    var mtime = this.state.mtime
    var modes = ['debug','release']

    if (!this.state.targets2.items) {
      //console.log(this.state.targets2)
      return
    }

    this.state.targets2.items.forEach(target => {
      //console.log('target',target)
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
    this.setState({active:!this.state.active})
    this.emit('set-active',this.state.active)
  }

  toggleModeSelect = () => {
    this.setState({modeSelect:!this.state.modeSelect})
  }

  handleMakeAll = (mode) => {
    /*this.state.targets
      .filter((target) => this.state.targetsVisibility[target.name])
      .forEach(target => this.handleProjectCommand('make', target, mode))*/

      let envName = this.currentEnvName()
      this.state.targets2.items
        .filter( target => target.envs.indexOf(envName) > -1 )
        .forEach( target => this.handleProjectCommand('make',target, mode) )

  }

  handleProjectCommand = (command, target, mode) => {
    this.emit('project-command',{command:command, target:target, mode: mode})
  }

  handleClean = (subj) => {
    let clean = (key) => {
      let value = this.state.tasks.running ? this.state[key].slice(-1) : []
      if (value.length > 0) {
        value[0].lines = []
      }
      this.setState({[key]:value})
    }
    
    var x = {
      'errors': () => clean('errors'),
      'stdout': () => clean('stdout'),
      'stderr': () => clean('stderr')
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

  currentEnvName() {
    let selected = this.state.envs.selected
    let items = this.state.envs.items
    if (items[selected]) {
      return items[selected].name
    }
  }

  renderTarget = (target,i) => {

    let mode = this.state.mode

    let makeCode = null
    let makeTime = null
    if (this.state.makeStat && this.state.makeStat[target.name] && this.state.makeStat[target.name][mode]) {
      makeCode = this.state.makeStat[target.name][mode].code
      makeTime = this.state.makeStat[target.name][mode].t
      if (makeTime != null) {
        makeTime = makeTime / 1000
      }
    }

    //let checked = this.state.targetsVisibility[target.name]
    
    
    let currentEnvName = this.currentEnvName()

    let hiddenRow = target.envs ? (target.envs.indexOf(currentEnvName) < 0) : false

    //hiddenRow = false
    
    let rowClasses = classNames({
      "hidden": hiddenRow,
      "compile-success": makeCode === 0, 
      "compile-error": makeCode !== 0 && makeCode !== null
    })

    let made
    if (this.state.made[target.name] && this.state.made[target.name][mode]) {
      made = this.state.made[target.name][mode]
    }

    let notBookmarks = this.state.commands2.items.filter(item => item.bookmark === false)

    //console.log('notBookmarks',notBookmarks)

    let renderMenuItem = (command,i) => <div key={i} className="menu-item" onClick={() => this.handleProjectCommand(command.name, target, mode)}> {command.name}</div>

    let menuShown = notBookmarks.filter(item => item.shown === true && item.bookmark === false).map(renderMenuItem)
    let menuHidden = notBookmarks.filter(item => item.shown === false && item.bookmark === false).map(renderMenuItem)

    return (<tr key={i} className={rowClasses}>
          <td>
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


  activeTargets() {
    let currentEnvName = this.currentEnvName()
    return this.state.targets2.items.filter(target => target.envs.indexOf(currentEnvName) > -1)
  }

  renderTargets = () => {

    let items = this.state.targets2.items

    if (!items) {
      console.log('!items')
      return
    }

    var targetsHeader = <tr><th>name</th><th>made</th><th>make</th><th>make time</th></tr>
    
    var targetsBody = items.map((target,i) => this.renderTarget(target,i))
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

    let renderTask = (task,i,running) => {
      let caption = task.cmd === 'kill' ? `${task.cmd} ${task.proc}` : `${task.cmd} ${task.mode} @ ${task.cwd}`
      return <li key={i} className={classNames({"task-running": running})}>{caption}</li>
    }

    return (<ul className="tasks">
              {running ? renderTask(running,-1,true) : null}
              {queued.map((task,i) => renderTask(task,i))}
            </ul>)
  }

  scrollStdOutAndStdErr = () => {
    setTimeout(()=>{
      let es = [this.refStdout.current, this.refStderr.current, this.refErrors.current]
      es.filter(e => e)
        .forEach(e => e.scrollTop = e.scrollHeight)
      
    },10)
  }

  renderEnvSelect() {
      
    let options = this.state.envs.items ? this.state.envs.items.map(item => ({value:item.name,label:item.name})) : []
    let onChange = (value) => {
        //console.log('onChange',value)
        let envs = this.state.envs
        let index = envs.items.map(env => env.name).indexOf(value)
        envs.selected = index
        this.setState({envs})
        this.emitSetEnv()
    }

    if (this.state.envs.items.length === 0) {
      return null
    }

    let selected = this.currentEnvName()

    if (!selected) {
      return null
    }

    return <Select className="env" options={options} onChange={onChange} selected={selected} />
  }

  emitSetEnv() {
    let envs = this.state.envs
    this.emit('set-env',envs.items[envs.selected])
  }

  render() {

    //console.log('render',+new Date())

    let targets = this.renderTargets()
    let tasks = this.renderTasks()
    //let bookmarks = this.renderBookmarks()
    this.scrollStdOutAndStdErr()
   
    //let bookmarks = this.state.bookmarks.map((bookmark,i) => )

    let bookmarks = this.state.commands2.items.filter(item => item.bookmark === true).map((item,i) => <MenuItem key={i} text={item.name} onClick={()=>this.emit('open-bookmark',item.name)}/>)

    //targets = null

    let envs = {
      title: <h3>envs</h3>,
      items: this.state.envs ? this.state.envs.items : [],
      selected: this.state.envs ? this.state.envs.selected : 0,
      editor: (item) => {
        let envs = this.state.envs
       
        let labels = ['name','path']
        let items = labels.map(name => <Input value={item[name]} onChange={value => {item[name] = value; this.setState({envs})}}/>)

        return <TwoColumnsTable labels={labels} items={items} prefix="env-input-"/>
      },
      onSelect: (selected) => {
        let envs = this.state.envs
        envs.selected = selected
        this.setState({envs})
        this.emitSetEnv()
      },
      onAdd: (value) => {
        let envs = this.state.envs
        let items = envs.items
        items.push({name:value,path:''})
        envs.selected = envs.items.length - 1
        this.setState({envs})
        this.emitSetEnv()
      },
      onRemove: (selected) => {
        let envs = this.state.envs
        let items = envs.items
        items.splice(selected,1)
        envs.selected = envs.items.length - 1
        this.setState({envs})
        this.emitSetEnv()
      },
    }

    let targets2 = {
      title: <h3>targets</h3>,
      items: this.state.targets2 ? this.state.targets2.items : [],
      selected: this.state.targets2 ? this.state.targets2.selected : 0,
      editor: (item) => {
        let onChange = (p,value) => {
          let targets2 = this.state.targets2
          item[p] = value
          this.setState({targets2})
        }
        return <TargetEdit envs={this.state.envs} item={item} onChange={onChange}/>
      },
      onSelect: (selected) => {
        let targets2 = this.state.targets2
        targets2.selected = selected
        this.setState({targets2})
      },
      onAdd: (value) => {
        let targets2 = Object.assign({},{items:[],selected:0},this.state.targets2)
        targets2.items.push({name:value,debug:'',release:'',cwd:'',kill:[],envs:[]})
        targets2.selected = targets2.items.length - 1
        this.setState({targets2})
      },
      onRemove: (selected) => {
        let targets2 = this.state.targets2
        targets2.items.splice(selected,1)
        targets2.selected = targets2.items.length - 1
        this.setState({targets2})
      }
    }

    let commands = {
      title: <h3>commands</h3>,
      items: this.state.commands2 ? this.state.commands2.items : [],
      selected: this.state.commands2 ? this.state.commands2.selected : 0,
      editor: (item) => {

        //console.log('editor(item)', item)

        let commands2 = this.state.commands2
        let labels = ['name','cmd']
        let items = labels.map(name => <Input value={item[name]} onChange={value => {item[name] = value; this.setState({commands2})}}/>)

        let labels2 = ['task','shown','bookmark']
        let items2 = labels2.map(name => <CheckBoxWithLabel label={name} checked={item[name]} onChange={checked => { item[name] = checked; this.setState({commands2})}} />)

        return <TwoColumnsTable labels={labels.concat(labels2.map(e => ''))} items={items.concat(items2)} prefix="command-input-"/>
      },
      onSelect: (selected) => {
        let commands2 = this.state.commands2
        commands2.selected = selected
        this.setState({commands2})
      },
      onAdd: (value) => {
        let commands2 = Object.assign({},{items:[],selected:0},this.state.commands2)
        let item = {name: value, task: false, shown: false, cmd: ''}
        commands2.items.push(item)
        commands2.selected = commands2.items.length - 1
        this.setState({commands2})
      },
      onRemove: (selected) => {
        let commands2 = this.state.commands2
        commands2.items.splice(selected,1)
        this.setState({commands2})
      }
    }

    //targets = null

    let handleEditFile = (args) => {
      this.emit('edit-file',args)
    }
    
    return (
      <div className="App">
        <FlexPaneContainer>

          <FlexPane title="config" mode="hidden">
            <FlexPaneBar>
              <FlexPaneButtons/>
              <FlexPaneTitle/>
            </FlexPaneBar>

              <div className="config-wrapper">
              <ListEdit {...envs} />
              <ListEdit {...targets2} />              
              <ListEdit {...commands} />
              </div>

              <button onClick={()=>{
                  let data = {envs:this.state.envs,targets:this.state.targets2,commands:this.state.commands2}
                  //console.log(data)
                  this.emit('set-config',data);
                  this.emit('mtime')
                }} >save</button>

          </FlexPane>

          <FlexPane title="targets">
            <FlexPaneBar className="top-menu">
                <FlexPaneButtons/>
                <FlexPaneTitle/>
                <MenuItem>
                  <CheckBoxWithLabel label="active" checked={this.state.active} onChange={this.handleActiveChange} />
                </MenuItem>
                <MenuItem>
                  {this.renderEnvSelect()}
                </MenuItem>
                <MenuItem>
                  <Select className="mode" options={[{value:'debug',label:'debug'},{value:'release',label:'release'}]} onChange={(value) => this.emit('set-mode',value)} selected={this.state.mode} />
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
            <StdOutputs data={this.state.errors} onAnchor={handleEditFile} showEmpty={false}/>
          </FlexPane>
          <FlexPane title="stdout" refPane={this.refStdout} className="stdout">
            <FlexPaneBar>
              <FlexPaneButtons/>
              <FlexPaneTitle/>
              <MugiMenu items={['clean']} onItemClick={() => this.handleClean('stdout')}/>
            </FlexPaneBar>
            <StdOutputs data={this.state.stdout} onAnchor={handleEditFile}/>
          </FlexPane>
          <FlexPane title="stderr" refPane={this.refStderr} className="stderr">
            <FlexPaneBar>
              <FlexPaneButtons/>
              <FlexPaneTitle/>
              <MugiMenu items={['clean']} onItemClick={() => this.handleClean('stderr')}/>
            </FlexPaneBar>
            <StdOutputs data={this.state.stderr} onAnchor={handleEditFile}/>
          </FlexPane>
        </FlexPaneContainer>
      </div>
    )
  }
}

export default App;
