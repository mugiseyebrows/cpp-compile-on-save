import React, { Component } from 'react'

import './App.css'
import './FlexPane.css'
import {FlexPane, FlexPaneContainer} from './FlexPane'
import io from 'socket.io-client'
import moment from 'moment'
import path from 'path'
import classNames from "classnames"
import CheckBox from './CheckBox'

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
    }

    this.refStdout = React.createRef()
    this.refStderr = React.createRef()

    const socket = io('http://localhost:4000')

    socket.on('proc-stdout',(obj) => {
      var stdout = this.state.stdout;
      stdout[stdout.length-1].data = stdout[stdout.length-1].data + obj.data
      this.setState({stdout:stdout})
    })

    socket.on('proc-stderr',(obj) => {
      var stderr = this.state.stderr
      var errors = this.state.errors
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

      var {cwd,mode} = obj

      var {stdout,stderr,errors} = this.state
      stdout = stdout.filter( item => !(item.cwd === cwd && item.mode === mode) )
      stderr = stderr.filter( item => !(item.cwd === cwd && item.mode === mode) )
      errors = errors.filter( item => !(item.cwd === cwd && item.mode === mode) )

      /*stdout = []
      stderr = []
      errors = []*/

      stdout.push({cwd:cwd,mode:mode,data:''})
      stderr.push({cwd:cwd,mode:mode,data:''})
      errors.push({cwd:cwd,mode:mode,data:[]})

      this.setState({stdout:stdout,stderr:stderr,errors:errors})
    })

    socket.on('proc-exit',(cwd)=>{
      //this.setState({cwd:null})
      socket.emit('get-targets')
    })

    socket.on('targets',(targets) => {
      this.setState({targets:targets})
      //console.log(targets)
    })

    socket.on('tasks',(tasks) => {
      this.setState({tasks:tasks})
    })


    socket.on('binary-changed',(p) => {
      socket.emit('get-targets')
    })

    socket.on('bookmarks',(bookmarks) => {
      this.setState({bookmarks:bookmarks})
    })

    /*fetch('/public/data.json')
      .then(data => data.json())
      .then(json => this.setState({panes:json}))*/

    var isActive = this.state.isActive
    
    socket.emit('get-targets')

    socket.emit('get-bookmarks')
    
    socket.emit('set-active',isActive)

    this.socket = socket
  }

  mtimeFromNow = (d) => {
    return moment(d,"YYYY-MM-DDTHH:mm:ss.SSSZ").fromNow()
  }

  handleFileClick = (filename) => {
    this.socket.emit('open-file',filename)
  }

  handleDirClick = (filename) => {
    this.socket.emit('open-dir',filename)
  }

  handleActiveChange = (e) => {
    var isActive = this.state.isActive
    isActive = !isActive
    this.setState({isActive:isActive})
    this.socket.emit('set-active',isActive)
  }

  handleCompileAllDebugClick = () => {
    this.socket.emit('compile-all','debug')
  }

  handleCompileAllReleaseClick = () => {
    this.socket.emit('compile-all','release')
  }

  handleCleanAllClick = () => {
    this.socket.emit('compile-all','clean')
  }

  handleCompileOne = (cwd,mode) => {
    this.socket.emit('compile-one',{cwd:cwd,mode:mode})
  }

  handleOpenProject = (target) => {
    if (target.pro != null) {
      this.socket.emit('open-project',target.pro)
    } else {
      var pro = target.cwd + "\\" + target.name + ".pro"
      this.socket.emit('open-project',pro)
    }
  }

  handleBookmark = (k) => {
    this.socket.emit('open-bookmark',k)
  }

  componentDidMount() {
    //console.log(this.refStdout,this.refStdout.current)
  }

  render() {

    var stdout = []
    var stderr = []
    var errors = []
    this.state.stdout.forEach((item,i) => { 
      stdout.push(<div key={i*2} className="proc-title">make {item.mode} @ {item.cwd}</div>)
      stdout.push(<div key={i*2+1} className="proc-data">{item.data}</div>)
    })
    this.state.stderr.forEach((item,i) => { 
      stderr.push(<div key={i*2} className="proc-title">make {item.mode} @ {item.cwd}</div>)
      //stderr.push(<div key={i*2+1} className="proc-data">{item.data}</div>)

      var data = item.data.split('\r\n').map((e,j) => {
        var cols = e.split(':')
        if (cols[0].endsWith('.cpp') || cols[0].endsWith('.h')) {
          var winpath = path.join(item.cwd,cols[0]).replace('/','\\')
          return <li key={j}><a href="#" onClick={() => this.handleFileClick(winpath)}>{cols[0]}</a>:{cols.slice(1).join(':')}</li>
        } 
        return <li key={j}>{e}</li>
      })
      stderr.push(<ul>{data}</ul>)

    })
    this.state.errors.forEach((item,i) => {
      if (item.data.length > 0) {
        var children = item.data.map((e,j) => {
          var cols = e.split(':')
          if (cols[0].endsWith('.cpp') || cols[0].endsWith('.h')) {
            var winpath = path.join(item.cwd,cols[0]).replace('/','\\')
            return <li key={j}><a href="#" onClick={() => this.handleFileClick(winpath)}>{cols[0]}</a>:{cols.slice(1).join(':')}</li>
          } else {
            return <li key={j}>{e}</li>
          }
        })
        
        errors.push(<div key={i*2} className="proc-title">make {item.mode} @ {item.cwd}</div>)
        errors.push(<ul key={i*2+1} className="proc-data" >{children}</ul>)
      }
    })
    //console.log('errors',this.state.errors)

    var targetsBody = this.state.targets.map( (target,i) => {
    
        var debugTime = this.mtimeFromNow(target.debugMtime)
        var releaseTime = this.mtimeFromNow(target.releaseMtime)

        var compileTime = target.compileTime['debug'] != null ? `${target.compileTime['debug'] / 1000}` : ''
        var compileCode = target.compileCode['debug']

        return (<tr key={i} className={classNames("hide-buttons",{"compile-success":compileCode === 0, "compile-error":compileCode !== 0 && compileCode !== null})}>
              <td>{target.name}</td>
              <td><a href="#" onClick={(e)=>{e.preventDefault(); this.handleDirClick(target.cwd)}}>{target.cwd}</a></td>
              <td>{debugTime}</td>
              <td>{releaseTime}</td>
              <td>
                <button className="compile-button" onClick={()=>this.handleCompileOne(target.cwd,'debug')}>debug</button>
                <button className="compile-button" onClick={()=>this.handleCompileOne(target.cwd,'release')}>release</button>
                <button className="compile-button" onClick={()=>this.handleCompileOne(target.cwd,'clean')}>clean</button>
                <button className="compile-button" onClick={()=>this.handleOpenProject(target)}>edit</button>
              </td>
              <td>{compileTime}</td>
              </tr>)
    })

    var targetsHeader = <tr><th>name</th><th>cwd</th><th>debug</th><th>release</th><th>compile</th><th>compile time</th></tr>

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
      this.refStdout.current.scrollTo(0,10000)
      this.refStderr.current.scrollTo(0,10000)
    },10)

    return (
      <div className="App">
        <FlexPaneContainer>
          <FlexPane title="targets" buttonsAfter={[
            <CheckBox label="active" isChecked={this.state.isActive} onChange={this.handleActiveChange} />,
            <div className="compile-label"> compile all </div>,
            <button key="0" className="compile" onClick={this.handleCompileAllDebugClick}>debug</button>,
            <button key="1" className="compile" onClick={this.handleCompileAllReleaseClick}>release</button>,
            <button key="2" className="compile" onClick={this.handleCleanAllClick}>clean</button>,
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
          <FlexPane title="stdout" mode="hidden" refPane={this.refStdout} className="stdout" >
            {stdout}
          </FlexPane>
          <FlexPane title="stderr" mode="hidden" refPane={this.refStderr} className="stderr" >
            {stderr}
          </FlexPane>
        </FlexPaneContainer>
      </div>
    )
  }
}

export default App;
