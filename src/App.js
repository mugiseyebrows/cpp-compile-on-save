import React, {Component} from 'react'
import {FlexPane, FlexPaneContainer, FlexPaneBar, FlexPaneButtons, FlexPaneTitle} from 'react-flexpane'
import 'react-flexpane/dist/styles.css'

import io from 'socket.io-client'
import classNames from "classnames"
import CheckBoxWithLabel from './CheckBoxWithLabel'
import Popup from "reactjs-popup";
//import Select from 'react-select'

import Star from './star.svg'

import {mtimeFromNow, dateTime, putLinks, defaults} from './Utils'

import StdOutputs from './StdOutputs'

import Select from './Select'

import './App.css'
import Input from './Input'
import ListEdit from './ListEdit'
import TargetEdit from './TargetEdit'
import TwoColumnsTable from './TwoColumnTable'
import TaskList from './TaskList'
import ProgressBar from './ProgressBar'
import MenuItem from './MenuItem'
import { isArray } from 'util';

function lastItem(vs) {
  return vs[vs.length-1]
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
      targets: {items: [], selected: 0},
      commands: {items: [], selected: 0},
      comName: 'none',
      comNames: [],
      cpuUsage: 0,
    }

    this.refStdout = React.createRef()
    this.refStderr = React.createRef()
    this.refErrors = React.createRef()

    this.socket = io('http://localhost:4000')

    let socket = this.socket

    let onstd = (name, obj) => {
      let out = this.state[name]
      if (out.length === 0) {
        console.log(`${name}.length === 0`)
        return
      }
      if (obj.cwd === undefined) {
        console.log('obj.cwd === undefined',obj)
      }

      if (obj.cwd === lastItem(out).cwd) {
        putLinks(obj.data, obj.cwd).forEach(line => lastItem(out).lines.push(line))
        lastItem(out).update++
      } else {
        //console.log(obj.cwd, lastItem(out).cwd)
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

      this.setState({stdout,stderr,errors})
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

    socket.on('mode',(mode)=>{
      //console.log('get-mode',mode)
      this.setState({mode:mode})
    })

    socket.on('config',(config)=>{
      let {envs, targets, commands, comName} = config
      this.setState({envs, targets, commands, comName})
      this.updateMade()
    })  

    socket.on('qt-project', target => {
      let targets = this.state.targets
      let target_ = targets.items.find(e => e.name === target.name)
      for(var k in target) {
        target_[k] = target[k]
      }
      this.setState({targets})
    })

    socket.on('com-names',(comNames)=>{
      this.setState({comNames})
    })

    socket.on('env',(env) => {
      let envs = this.state.envs
      let index = env === null ? 0 : envs.items.indexOf(envs.items.find(env_ => env_.name === env.name))
      envs.selected = index
      this.setState({envs})
    })

    socket.on('cpuusage', (cpuUsage) => {
      this.setState({cpuUsage})
    })

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

    if (!this.state.targets.items) {
      //console.log(this.state.targets)
      return
    }

    this.state.targets.items.forEach(target => {
      //console.log('target',target)
      made[target.name] = {debug:null,release:null}
      modes.forEach(mode => {
        if (mtime[target.name] && mtime[target.name][mode]) {
          let t = mtimeFromNow(mtime[target.name][mode])
          made[target.name][mode] = t
        }
      })
    })

    this.setState({made:made})
  }

  toggleModeSelect = () => {
    this.setState({modeSelect:!this.state.modeSelect})
  }

  handleMakeAll = (name) => {
    /*this.state.targets
      .filter((target) => this.state.targetsVisibility[target.name])
      .forEach(target => this.handleProjectCommand('make', target, mode))*/

      let envName = this.currentEnvName()
      this.state.targets.items
        .filter( target => target.envs.indexOf(envName) > -1 )
        .forEach( target => this.handleProjectCommand(name,target) )

  }

  handleProjectCommand = (name, target) => {
    this.emit('project-command',{name:name, target:target, mode: this.state.mode})
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
    let mtime
    if (this.state.mtime[target.name] && this.state.mtime[target.name][mode]) {
      mtime = dateTime(this.state.mtime[target.name][mode])
    }

    let commands = defaults({items:[],selected:0}, this.state.commands)

    //let notBookmarks = commands.items.filter(item => item.bookmark === false && ['edit-file','explore'].indexOf(item.name) < 0)

    //console.log('notBookmarks',notBookmarks)

    let renderMenuItem = (command,i) => <div key={i} className="menu-item" onClick={() => this.handleProjectCommand(command.name, target, mode)}> {command.name}</div>

    let menuShown = commands.items.filter(item => item.context === 'target').map(renderMenuItem)
    let menuHidden = commands.items.filter(item => item.context === 'target-popup').map(renderMenuItem)

    return (<tr key={i} className={rowClasses}>
          <td>
            <MenuItem text={target.name} onClick={() => this.handleExploreOrCheck(target,i)} />
          </td>
          <td>
          <Popup trigger={<div className="mktime">{made}</div>} on="hover" arrow={false}>
            <div>{mtime}</div>
          </Popup>
          </td>
          <td className="menu-target">
            {menuShown}
            <Popup
              trigger={<div className="menu-item"> ... </div>}
              position="right top"
              on="hover"
              closeOnDocumentClick
              mouseLeaveDelay={0}
              mouseEnterDelay={0}
              contentStyle={{ padding: '0px', width: '100px', textAlign: 'center', margin: '0px' }}
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
    return this.state.targets.items.filter(target => target.envs.indexOf(currentEnvName) > -1)
  }

  renderTargets = () => {

    let items = this.state.targets.items

    if (!items) {
      console.log('!items')
      return
    }

    var targetsHeader = <tr><th>name</th><th>made</th><th>commands</th><th>make time</th></tr>
    
    var targetsBody = items.map((target,i) => this.renderTarget(target,i))
    return (<table className="targets">
              <thead>{targetsHeader}</thead>
              <tbody>{targetsBody}</tbody>
            </table>)
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

    //let targets = this.renderTargets()
    
    //let bookmarks = this.renderBookmarks()
    
    //let bookmarks = this.state.bookmarks.map((bookmark,i) => )

    let commands_ = defaults({items:[],selected:0},this.state.commands)

    let bookmarks = commands_.items.filter(item => item.context === 'bookmark').map((item,i) => <MenuItem key={i} text={item.name} onClick={()=>this.emit('open-bookmark',item.name)}/>)

    //targets = null

    let checkbox = (item, name, update) => <CheckBoxWithLabel label={name} checked={item[name]} onChange={checked => { item[name] = checked; update(item) }}/>
    
    let envs = {
      title: <h3>envs</h3>,
      items: this.state.envs ? this.state.envs.items : [],
      selected: this.state.envs ? this.state.envs.selected : 0,
      editor: (item) => {
        let envs = this.state.envs
       
        let labels = ['name','path']
        let items = labels.map(name => <Input value={item[name]} onChange={value => {item[name] = value; this.setState({envs})}}/>)

        let modeOptions = ['replace','prepend','append']

        let select = <Select id="path-mode" options={modeOptions} selected={item.mode || 'replace'} onChange={(value) => {
          item.mode = value
          this.setState({envs})
        }}/>

        labels.push('mode')
        items.push(select)

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
        items.push({name:value,path:'',mode:'replace'})
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

    let targets = {
      title: <h3>targets</h3>,
      items: this.state.targets ? this.state.targets.items : [],
      selected: this.state.targets ? this.state.targets.selected : 0,
      editor: (item) => {
        let onChange = (p,value) => {
          let targets = this.state.targets
          item[p] = value
          this.setState({targets})
        }
        let onQtProject = (item) => {
          this.emit('qt-project',item)
        }

        return <TargetEdit envs={this.state.envs} item={item} onChange={onChange} onQtProject={onQtProject}/>
      },
      onSelect: (selected) => {
        let targets = this.state.targets
        targets.selected = selected
        this.setState({targets})
      },
      onAdd: (value) => {
        let targets = defaults({},{items:[],selected:0},this.state.targets)
        targets.items.push({name:value,debug:'',release:'',cwd:'',pro:'',kill:'',envs:[]})
        targets.selected = targets.items.length - 1
        this.setState({targets})
      },
      onRemove: (selected) => {
        let targets = this.state.targets
        targets.items.splice(selected,1)
        targets.selected = targets.items.length - 1
        this.setState({targets})
      }
    }

    let commands = {
      title: <h3>commands</h3>,
      items: this.state.commands ? this.state.commands.items : [],
      selected: this.state.commands ? this.state.commands.selected : 0,
      editor: (item) => {

        //console.log('editor(item)', item)

        let commands = this.state.commands
        let labels = ['name','cmd','task','context']
        let items = ['name','cmd'].map(name => <Input value={item[name]} onChange={value => {item[name] = value; this.setState({commands})}}/>)

        items.push(checkbox(item,'task',()=>{this.setState({commands})}))
        
        let contextOptions = ['target','target-popup','bookmark','hidden']

        items.push( <Select options={contextOptions} selected={item.context || 'target-popup'} onChange={(value) => {
          item.context = value
          this.setState({commands})
        }}/> )
        
        return <TwoColumnsTable labels={labels} items={items} prefix="command-input-"/>
      },
      onSelect: (selected) => {
        let commands = this.state.commands
        commands.selected = selected
        this.setState({commands})
      },
      onAdd: (value) => {
        let commands = defaults({items:[],selected:0},this.state.commands)
        let item = {name: value, cmd: '', task: false, context: 'target-popup'}
        commands.items.push(item)
        commands.selected = commands.items.length - 1
        this.setState({commands})
      },
      onRemove: (selected) => {
        let commands = this.state.commands
        commands.items.splice(selected,1)
        this.setState({commands})
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
              <ListEdit {...targets} />              
              <ListEdit {...commands} />
              </div>

              <div className="serial-port-wrapper">
              <label> Serial port&nbsp;
              {this.state.comNames.length > 0 ? <Select options={this.state.comNames} selected={this.state.comName} onChange={(comName)=>{this.setState({comName})}}/> : null }
              </label>&nbsp;
              <button onClick={() => this.emit('com-names',true)}> refresh </button>
              </div>

              <button onClick={()=>{
                  let {envs, targets, commands, comName} = this.state
                  let data = {envs, targets, commands, comName}
                  //console.log(data)
                  this.emit('set-config',data)
                }} >save</button>

          </FlexPane>

          <FlexPane title="targets">
            <FlexPaneBar className="top-menu">
                <FlexPaneButtons/>
                <FlexPaneTitle/>
                <MenuItem>
                  <CheckBoxWithLabel label="active" checked={this.state.active} onChange={(active) => {this.setState({active}); this.emit('set-active',active)}} />
                </MenuItem>
                <MenuItem>
                  {this.renderEnvSelect()}
                </MenuItem>
                <MenuItem>
                  <Select className="mode" options={[{value:'debug',label:'debug'},{value:'release',label:'release'}]} onChange={(value) => this.emit('set-mode',value)} selected={this.state.mode} />
                </MenuItem>
                <MenuItem className="menu-spacer"/>
                <MenuItem text="qmake" onClick={() => this.handleMakeAll('qmake')}/>
                <MenuItem text="make" onClick={() => this.handleMakeAll('make')}/>
                <MenuItem text="clean" onClick={() => this.handleMakeAll('clean')}/>
                
                <Popup trigger={<div className="menu-item"><img src={Star} alt="Star"/></div>} position="bottom right" on="hover" arrow={false} contentStyle={{width:'110px', textAlign: 'center', padding: '0px'}} >
                  <div>
                    {bookmarks}
                  </div>
                </Popup>
              
            </FlexPaneBar>
            {this.renderTargets()}

          </FlexPane>
          <FlexPane title="tasks">
            <FlexPaneBar className="tasks-menu">
              <FlexPaneButtons/>
              <FlexPaneTitle/>
              <MenuItem text="abort" onClick={() => this.emit('abort')}/>
              <MenuItem text="cancel" onClick={() => this.emit('cancel')}/>
              <ProgressBar value={this.state.cpuUsage} maxValue={1.0}/>
            </FlexPaneBar>
            <TaskList tasks={this.state.tasks}/>
          </FlexPane>
          <FlexPane title="errors" refPane={this.refErrors} className="errors">
            <FlexPaneBar className="errors-menu">
              <FlexPaneButtons/>
              <FlexPaneTitle/>
              <MenuItem text="clean" onClick={() => this.handleClean('errors')}/>
            </FlexPaneBar>
            <StdOutputs data={this.state.errors} onAnchor={handleEditFile} showEmpty={false} refPane={this.refErrors}/>
          </FlexPane>
          <FlexPane title="stdout" refPane={this.refStdout} className="stdout">
            <FlexPaneBar className="stdout-menu">
              <FlexPaneButtons/>
              <FlexPaneTitle/>
              <MenuItem text="clean" onClick={() => this.handleClean('stdout')}/>
            </FlexPaneBar>
            <StdOutputs data={this.state.stdout} onAnchor={handleEditFile} refPane={this.refStdout}/>
          </FlexPane>
          <FlexPane title="stderr" refPane={this.refStderr} className="stderr">
            <FlexPaneBar className="stderr-menu">
              <FlexPaneButtons/>
              <FlexPaneTitle/>
              <MenuItem text="clean" onClick={() => this.handleClean('stderr')}/>
            </FlexPaneBar>
            <StdOutputs data={this.state.stderr} onAnchor={handleEditFile} refPane={this.refStderr}/>
          </FlexPane>
        </FlexPaneContainer>
      </div>
    )
  }
}

export default App;
