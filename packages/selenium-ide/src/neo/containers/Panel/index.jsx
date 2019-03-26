// Licensed to the Software Freedom Conservancy (SFC) under one
// or more contributor license agreements.  See the NOTICE file
// distributed with this work for additional information
// regarding copyright ownership.  The SFC licenses this file
// to you under the Apache License, Version 2.0 (the
// "License"); you may not use this file except in compliance
// with the License.  You may obtain a copy of the License at
//
//   http://www.apache.org/licenses/LICENSE-2.0
//
// Unless required by applicable law or agreed to in writing,
// software distributed under the License is distributed on an
// "AS IS" BASIS, WITHOUT WARRANTIES OR CONDITIONS OF ANY
// KIND, either express or implied.  See the License for the
// specific language governing permissions and limitations
// under the License.

import browser from 'webextension-polyfill'
import React from 'react'
import { observable } from 'mobx'
import { observer } from 'mobx-react'
import { DragDropContext } from 'react-dnd'
import HTML5Backend from 'react-dnd-html5-backend'
//import SplitPane from 'react-split-pane'
//import classNames from 'classnames'
import { modifier } from 'modifier-keys'
import Tooltip from '../../components/Tooltip'
import storage from '../../IO/storage'
import ProjectStore from '../../stores/domain/ProjectStore'
import seed from '../../stores/seed'
import SuiteDropzone from '../../components/SuiteDropzone'
import PauseBanner from '../../components/PauseBanner'
import ProjectHeader from '../../components/ProjectHeader'
//import Navigation from '../Navigation'
//import Editor from '../Editor'
import Console from '../Console'
import Modal from '../Modal'
import Changelog from '../../components/Changelog'
import UiState from '../../stores/view/UiState'
import PlaybackState from '../../stores/view/PlaybackState'
import ModalState from '../../stores/view/ModalState'
import '../../side-effects/contextMenu'
import '../../styles/app.css'
import '../../styles/font.css'
import '../../styles/layout.css'
import '../../styles/resizer.css'
import { isProduction, isTest, userAgent } from '../../../common/utils'
import Logger from '../../stores/view/Logs'
import LoginPage from '../../components/LoginPage'

import { loadProject, saveProject, loadJSProject } from '../../IO/filesystem'
import RemoveButton from '../../components/ActionButtons/Remove';

let backendUrl = null;
const prodUrl = 'https://superbot.cloud';
const stagingUrl = 'http://svc.vodka';
/*
const prodUrl = 'http://localhost:3000';
const stagingUrl = 'http://localhost:3000';
*/

if (!isTest) {
  const api = require('../../../api')
  browser.runtime.onMessage.addListener(api.default)
}

if (userAgent.os.name === 'Windows') {
  require('../../styles/conditional/scrollbar.css')
  require('../../styles/conditional/button-direction.css')
  require('../../styles/conditional/text.css')
}

const project = observable(new ProjectStore(''))

UiState.setProject(project)

if (isProduction) {
  createDefaultSuite(project, { suite: '', test: '' })
} else {
  seed(project)
}
project.setModified(false)

function createDefaultSuite(
  aProject,
  name = { suite: 'Default Suite', test: 'Untitled' }
) {
  const suite = aProject.createSuite(name.suite)
  const test = aProject.createTestCase(name.test)
  suite.addTestCase(test)
  UiState.selectTest(test)
}

function firefox57WorkaroundForBlankPanel() {
  // TODO: remove this as soon as Mozilla fixes https://bugzilla.mozilla.org/show_bug.cgi?id=1425829
  // browser. windows. create () displays blank windows (panel, popup or detached_panel)
  // The trick to display content is to resize the window...
  // We do not check the browser since this doesn't affect chrome at all

  function getCurrentWindow() {
    return browser.windows.getCurrent()
  }

  getCurrentWindow().then(currentWindow => {
    const updateInfo = {
      width: currentWindow.width,
      height: currentWindow.height + 1, // 1 pixel more than original size...
    }
    browser.windows.update(currentWindow.id, updateInfo)
  })
}

if (browser.windows) {
  firefox57WorkaroundForBlankPanel()
}

@DragDropContext(HTML5Backend)
@observer
export default class Panel extends React.Component {
  constructor(props) {
    super(props)
    this.state = { project, user: null, stagingEnabled: false,  showStagingNotification: true, showUploadWarning: true }
    this.parseKeyDown = this.parseKeyDown.bind(this)
    this.keyDownHandler = window.document.body.onkeydown = this.handleKeyDown.bind(
      this
    )
    if (isProduction) {
      // the handler writes the size to the extension storage, which throws in development
      this.resizeHandler = window.addEventListener(
        'resize',
        this.handleResize.bind(this, window)
      )
      this.quitHandler = window.addEventListener('beforeunload', e => {
        if (project.modified) {
          const confirmationMessage =
            'You have some unsaved changes, are you sure you want to leave?'

          e.returnValue = confirmationMessage
          return confirmationMessage
        }
      })
      this.moveInterval = setInterval(() => {
        storage.set({
          origin: {
            top: window.screenY,
            left: window.screenX,
          },
        })
      }, 3000)
    }
  }
  handleResize(currWindow) {
    UiState.setWindowHeight(currWindow.innerHeight)
    storage.set({
      size: {
        height: currWindow.outerHeight,
        width: currWindow.outerWidth,
      },
    })
  }
  parseKeyDown(e) {
    modifier(e)
    return {
      key: e.key.toUpperCase(),
      primaryAndShift: e.primaryKey && e.shiftKey,
      onlyPrimary: e.primaryKey && !e.secondaryKey,
      noModifiers: !e.primaryKey && !e.secondaryKey,
    }
  }
  handleKeyDown(e) {
    const key = this.parseKeyDown(e)
    // when editing these, remember to edit the button's tooltip as well
    if (key.primaryAndShift && key.key === 'N') {
      e.preventDefault()
      this.loadNewProject()
    } else if (key.onlyPrimary && key.key === 'N') {
      e.preventDefault()
    } else if (key.onlyPrimary && key.key === 'S') {
      e.preventDefault()
      saveProject(this.state.project)
    } else if (key.onlyPrimary && key.key === 'O' && this.openFile) {
      e.preventDefault()
      this.openFile()
    } else if (key.onlyPrimary && key.key === '1') {
      // test view
      e.preventDefault()
      UiState.changeView(UiState.views[+key - 1])
    } else if (key.onlyPrimary && key.key === '2') {
      // suite view
      e.preventDefault()
      UiState.changeView(UiState.views[+key - 1])
    } else if (key.onlyPrimary && key.key === '3') {
      // execution view
      e.preventDefault()
      UiState.changeView(UiState.views[+key - 1])
    } else if (key.primaryAndShift && e.code === 'KeyR' && isProduction) {
      // run suite
      e.preventDefault()
      if (PlaybackState.canPlaySuite) {
        PlaybackState.playSuiteOrResume()
      }
    } else if (key.onlyPrimary && key.key === 'R' && isProduction) {
      // run test
      e.preventDefault()
      if (!PlaybackState.isPlayingSuite) {
        PlaybackState.playTestOrResume()
      }
    } else if (key.onlyPrimary && key.key === 'P') {
      // pause
      e.preventDefault()
      PlaybackState.pauseOrResume()
    } else if (key.onlyPrimary && key.key === '.') {
      // stop
      e.preventDefault()
      PlaybackState.abortPlaying()
    } else if (key.onlyPrimary && key.key === "'") {
      // step over
      e.preventDefault()
      PlaybackState.stepOver()
    } else if (key.onlyPrimary && key.key === 'Y') {
      // disable breakpoints
      e.preventDefault()
      PlaybackState.toggleDisableBreakpoints()
    } else if (key.onlyPrimary && key.key === 'U') {
      // record
      e.preventDefault()
      if (!PlaybackState.isPlaying) {
        UiState.toggleRecord()
      }
    }
  }
  handleKeyDownAlt(e) {
    // The escape key is used in internal dialog modals to cancel. But the key
    // bubbles to the body event listener in Panel's ctor. Moving the event
    // listener into the top-level div in render prevents the keys from being
    // recognized unless an internal component has focus (e.g., selecting a test,
    // a test command, or an element within the command form).
    //
    // To fix, separating the key handling into two functions. One with just escape
    // that will live on the top-level div. The other with the remaining keys that
    // will live in an event listener on document.body.
    const key = this.parseKeyDown(e)
    if (key.noModifiers && key.key === 'ESCAPE') {
      UiState.toggleConsole()
    }
  }
  async loadNewProject() {
    if (!UiState.isSaved()) {
      const choseProceed = await ModalState.showAlert({
        title: 'Create without saving',
        description:
          'Are you sure you would like to create a new project without saving the current one?',
        confirmLabel: 'proceed',
        cancelLabel: 'cancel',
      })
      if (choseProceed) {
        await UiState.stopRecording({ nameNewTest: false })
        this.createNewProject()
      }
    } else if (UiState.isRecording) {
      const choseProceed = await ModalState.showAlert({
        title: 'Stop recording',
        description:
          'Are you sure you would to stop recording and create a new project?',
        confirmLabel: 'proceed',
        cancelLabel: 'cancel',
      })
      if (choseProceed) {
        await UiState.stopRecording({ nameNewTest: false })
        this.createNewProject()
      }
    } else {
      this.createNewProject()
    }
  }
  createNewProject() {
    this.setState({ showUploadWarning: true }, () => { 
      const name = 'Untitled Test';
      const newProject = observable(new ProjectStore(name))
      createDefaultSuite(newProject, { suite: 'Default Suite', test: name })
      loadJSProject(project, newProject.toJS())
      Logger.clearLogs()
      newProject.setModified(false)
      UiState.selectTest(this.state.project._tests[0], this.state.project._suites[0]);
    })
  }

  handleLogin = () => {
    return new Promise(resolve => {
      fetch(`${backendUrl}/login/cloud/credentials.json`)
      .then(res => {
        if(res.status === 200 && res.redirected === false){
          return res.json()
        } else if (res.status === 200 && res.redirected === true){
          return Promise.reject('Login needed!')
        } else {
          return Promise.reject('Error fetching credentials!')
        }
      }).then(creds => {
        console.log('login creds', creds)
        this.setState({ user: creds }, () => {
          this.loadNewProject();
          this.getOrganizations();
          resolve();
        });
      }).catch(e => console.log(e))
    })
  }

  getOrganizations = () => {
    fetch(`${backendUrl}/api/v1/organizations`, {
      method: 'GET',
      headers: {
        'Authorization': this.getAuthorizationToken()
      }
    }).then(res => {
      if(res.status === 200){
        return res.json();
      } else {
        return Promise.reject('Failed to fetch organizations');
      }
    }).then(res => {
      this.setState({ user: {...this.state.user, allOrganizations: {...res} }});
    })
  }

  getAuthorizationToken = () => `Basic ${new Buffer(this.state.user.username + ':' + this.state.user.token).toString('base64')}`

  filterOpenedTest = (id) => {
    return new Promise(resolve => {
      fetch(`${backendUrl}/api/v1/tests?organization_name=${this.state.user.organization}`, {
        method: 'GET',
        headers: {
          'Authorization': this.getAuthorizationToken()
        }
      }).then(res => {
        if(res.status === 200){
          return res.json();
        } else {
          return Promise.reject('Failed to fetch tests!');
        }
      }).then(res => {
        for(let i = 0; i < res.tests.length; i++){
          for(let x = 0; x < res.tests[i].files.length; x++){
            if(res.tests[i].files[x].id === id){
              return resolve(res.tests[i].files[x]);
            }
          }
        }
        return null;
      })
    })
  }

  uploadTest = async () => {
    if(this.state.showUploadWarning){
      const playTest = await ModalState.showAlert({
        title: 'You have not ran your test yet',
        description: '...and you probably should before uploading it to the cloud. Do it now?',
        cancelLabel: 'No',
        confirmLabel: 'Yes',
      });
      this.setState({ showUploadWarning: false });
      if(playTest){
        if (PlaybackState.canPlaySuite) {
          PlaybackState.playSuiteOrResume()
        } else {
          PlaybackState.playFilteredTestsOrResume()
        }
        return;
      }
    }

    if(this.state.project.name === null || this.state.project.name === 'Untitled Test'){
      const newName = await ModalState.renameProject('test case', this.state.project.name, { isNewTest: false });
      await new Promise(resolve => {
        const newProject = {...this.state.project};
        newProject.name = newName;
        this.setState({ project: newProject }, () => {
          resolve();
        });
      })
    }

    const suite = {
      name: this.state.project.name,
      organization_name: this.state.user.organization,
      description: '',
      files: [{ content: this.state.project.toJS() }]
    }

    let formData = new FormData()
    for (let key in suite){
      if(key !== 'files'){
        formData.append(key, suite[key])
      }
    }
    for(let i = 0; i < suite.files.length; i++){
      formData.append('files[]', new Blob([JSON.stringify(suite.files[i].content)]), this.state.project.name)
    }

    fetch(`${backendUrl}/api/v1/tests`, {
      method: 'POST',
      body: formData,
      headers: {
        'Authorization': this.getAuthorizationToken()
      }
    }).then(res => {
      if(res.status === 200){
        return res.json()
      } else {
        return Promise.reject('Error updating suite!')
      }
    }).then(() => {
      UiState.saved()
      alert('Test saved')
    })
    .catch(e => console.log(e))
  }

  extensionLoadTest = async (message) => {
    if(message.type !== 'extensionLoadTest') return;

    try {
      if(this.state.user === null){
        await this.handleLogin();
      }
      const test = await this.filterOpenedTest(message.testId);
      const newProject = observable(new ProjectStore(''))
      newProject.fromJS(JSON.parse(test.content));
      newProject.setModified(false);
      Logger.clearLogs()
      this.setState({ project: newProject, showUploadWarning: false }, () => {
        loadJSProject(this.state.project, newProject.toJS());
        UiState.selectTest(this.state.project._tests[0], this.state.project._suites[0]);
      });
    } catch(e){
      console.log('Error loading test:', e)
    }
  }

  logoutUser = () => {
    if(!confirm('Are you sure you want to logout?')) return;

    let organizationId = null;
    for(const key of Object.keys(this.state.user.allOrganizations)){
      if(this.state.user.organization === this.state.user.allOrganizations[key].name){
        organizationId = this.state.user.allOrganizations[key].id;
      }
    }
    if(organizationId === null){
      return alert('Error logging out: could not find organization id!');
    }

    fetch(`${backendUrl}/logout`, {
      method: 'GET',
      headers: {
        'Authorization': this.getAuthorizationToken()
      }
    }).then(res => {
      if(res.status === 200){
        this.setState({ project: null, user: null, stagingEnabled: false, showStagingNotification: true, showUploadWarning: true });
      } else {
        console.log('Logging out failed, status:', res.status)
      }
    })
  }

  disableUploadWarning = () => {
    this.setState({ showUploadWarning: false })
  }

  componentWillMount(){
    const stagingEnabled = (localStorage.getItem('stagingEnabled') === 'true');
    backendUrl = stagingEnabled ? stagingUrl : prodUrl;
    chrome.runtime.onMessage.addListener(this.extensionLoadTest);
    this.setState({ stagingEnabled }, () => {
      this.handleLogin();
    });

    window.addEventListener('keypress', (event) => {
      if(event.key === '§'){
        backendUrl = !this.state.stagingEnabled ? stagingUrl : prodUrl;
        this.setState({ user: null, stagingEnabled: !this.state.stagingEnabled, showStagingNotification: !this.state.stagingEnabled }, async () => {
          localStorage.setItem('stagingEnabled', !stagingEnabled ? 'true' : 'false');
          await this.handleLogin();
        });
      }
    })
  }

  componentWillUnmount() {
    if (isProduction) {
      clearInterval(this.moveInterval)
      window.removeEventListener('resize', this.resizeHandler)
      window.removeEventListener('beforeunload', this.quitHandler)
    }
  }
  /*
  drawCanvasFromImage = () => {
    const image = document.getElementById('opencv-test-image');
    const mat = cv.imread(image);
    cv.imshow('test-canvas', mat);
    mat.delete();
  }
  */
  render() {
    if(this.state.user === null){
      return (
        <LoginPage
          handleLogin={this.handleLogin}
          backendUrl={backendUrl}
        />
      )
    }
    return (
      <div className="container" onKeyDown={this.handleKeyDownAlt.bind(this)}>
        {/*
        <image
          id='opencv-test-image'
          src='./robot_face.svg'
          alt='robot_face'
          onLoad={this.drawCanvasFromImage}
        />
        <canvas id='test-canvas' />
        */}
        {this.state.stagingEnabled ? (
          <div 
            className='staging-notifier'
            style={{
              backgroundColor: '#40a6ff',
              color: '#fff',
              padding: '2px',
              textAlign: 'center',
              display: this.state.showStagingNotification ? 'block' : 'none'
            }}
          >
            <p 
              style={{ 
                padding: '2px',
                margin: '0px',
                display: 'inline-block'
              }}
            >using staging back-end</p>
            <RemoveButton
              onClick={() => this.setState({ showStagingNotification: false })}
              style={{
                float: 'right',
                fontSize: '18px',
                color: '#fff',
                height: '18px',
                fontWeight: 'bold'
              }}
            />
          </div>
        ) : null}
        <SuiteDropzone
          loadProject={loadProject.bind(undefined, this.state.project)}
        >
          <div className="wrapper">
            <PauseBanner />
            <ProjectHeader
              title={this.state.project.name}
              changed={this.state.project.modified}
              changeName={this.state.project.changeName}
              openFile={openFile => {
                this.openFile = openFile
              }}
              load={loadProject.bind(undefined, this.state.project)}
              //save={() => saveProject(this.state.project)}
              save={this.uploadTest}
              new={this.loadNewProject.bind(this)}
              logout={this.logoutUser}
              clearAllCommands={UiState.displayedTest.clearAllCommands}
              disableUploadWarning={this.disableUploadWarning}
            />
            <Console
              url={this.state.project.url}
              urls={this.state.project.urls}
              setUrl={this.state.project.setUrl}
              test={this.state.project._tests[0]}
              callstackIndex={UiState.selectedTest.stack}
              isRecording={UiState.isRecording}
              isPlaying={PlaybackState.isPlaying}
            />
          </div>
          <Modal
            project={this.state.project}
            createNewProject={this.createNewProject.bind(this)}
          />
          <Changelog />
          <Tooltip />
        </SuiteDropzone>
      </div>
    )
  }
}