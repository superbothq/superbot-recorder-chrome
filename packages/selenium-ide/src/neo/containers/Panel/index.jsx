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
import SplitPane from 'react-split-pane'
import classNames from 'classnames'
import { modifier } from 'modifier-keys'
import Tooltip from '../../components/Tooltip'
import storage from '../../IO/storage'
import ProjectStore from '../../stores/domain/ProjectStore'
import seed from '../../stores/seed'
import SuiteDropzone from '../../components/SuiteDropzone'
import PauseBanner from '../../components/PauseBanner'
import ProjectHeader from '../../components/ProjectHeader'
import SuperbotNavigation from '../Superbot/Navigation'
import Editor from '../Editor'
import Modal from '../Modal'
import Changelog from '../../components/Changelog'
import UiState from '../../stores/view/Superbot/UiState'
import PlaybackState from '../../stores/view/PlaybackState'
import ModalState from '../../stores/view/ModalState'
import '../../side-effects/contextMenu'
import '../../styles/app.css'
import '../../styles/font.css'
import '../../styles/layout.css'
import '../../styles/resizer.css'
import { isProduction, isTest, userAgent } from '../../../common/utils'
import Logger from '../../stores/view/Logs'

import { loadProject, saveProject, loadJSProject } from '../../IO/filesystem'

import LoginPage from '../../components/LoginPage'


if (!isTest) {
  const api = require('../../../api')
  browser.runtime.onMessage.addListener(api.default)
}

if (userAgent.os.name === 'Windows') {
  require('../../styles/conditional/scrollbar.css')
  require('../../styles/conditional/button-direction.css')
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
    this.state = { project, user: {} }
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
  handleKeyDown(e) {
    modifier(e)
    const key = e.key.toUpperCase()
    const primaryAndShift = e.primaryKey && e.shiftKey
    const onlyPrimary = e.primaryKey && !e.secondaryKey
    const noModifiers = !e.primaryKey && !e.secondaryKey

    // when editing these, remember to edit the button's tooltip as well
    if (primaryAndShift && key === 'N') {
      e.preventDefault()
      this.loadNewProject()
    } else if (onlyPrimary && key === 'N') {
      e.preventDefault()
    } else if (onlyPrimary && key === 'S') {
      e.preventDefault()
      saveProject(this.state.project)
    } else if (onlyPrimary && key === 'O' && this.openFile) {
      e.preventDefault()
      this.openFile()
    } else if (onlyPrimary && key === '1') {
      // test view
      e.preventDefault()
      UiState.changeView(UiState.views[+key - 1])
    } else if (onlyPrimary && key === '2') {
      // suite view
      e.preventDefault()
      UiState.changeView(UiState.views[+key - 1])
    } else if (onlyPrimary && key === '3') {
      // execution view
      e.preventDefault()
      UiState.changeView(UiState.views[+key - 1])
    } else if (primaryAndShift && e.code === 'KeyR' && isProduction) {
      // run suite
      e.preventDefault()
      if (PlaybackState.canPlaySuite) {
        PlaybackState.playSuiteOrResume()
      }
    } else if (onlyPrimary && key === 'R' && isProduction) {
      // run test
      e.preventDefault()
      if (!PlaybackState.isPlayingSuite) {
        PlaybackState.playTestOrResume()
      }
    } else if (onlyPrimary && key === 'P') {
      // pause
      e.preventDefault()
      PlaybackState.pauseOrResume()
    } else if (onlyPrimary && key === '.') {
      // stop
      e.preventDefault()
      PlaybackState.abortPlaying()
    } else if (onlyPrimary && key === "'") {
      // step over
      e.preventDefault()
      PlaybackState.stepOver()
    } else if (onlyPrimary && key === 'Y') {
      // disable breakpoints
      e.preventDefault()
      PlaybackState.toggleDisableBreakpoints()
    } else if (onlyPrimary && key === 'U') {
      // record
      e.preventDefault()
      if (!PlaybackState.isPlaying) {
        UiState.toggleRecord()
      }
    } else if (noModifiers && key === 'ESCAPE') {
      UiState.toggleConsole()
    }
  }
  navigationDragStart() {
    UiState.setNavigationDragging(true)
    UiState.resizeNavigation(UiState.navigationWidth)
    UiState.setNavigationHover(true)
  }
  navigationDragEnd() {
    UiState.setNavigationDragging(false)
    UiState.setNavigationHover(false)
  }
  loadNewProject() {
    if (!UiState.isSaved()) {
      ModalState.showAlert(
        {
          title: 'Create without saving',
          description:
            'Are you sure you would like to create a new project without saving the current one?',
          confirmLabel: 'Proceed',
          cancelLabel: 'Cancel',
        },
        async choseProceed => {
          if (choseProceed) {
            await UiState.stopRecording({ nameNewTest: false })
            this.createNewProject()
          }
        }
      )
    } else if (UiState.isRecording) {
      ModalState.showAlert(
        {
          title: 'Stop recording',
          description:
            'Are you sure you would to stop recording and create a new project?',
          confirmLabel: 'Proceed',
          cancelLabel: 'Cancel',
        },
        async choseProceed => {
          if (choseProceed) {
            await UiState.stopRecording({ nameNewTest: false })
            this.createNewProject()
          }
        }
      )
    } else {
      this.createNewProject()
    }
  }
  async createNewProject() {
    const name = await ModalState.renameProject()
    const newProject = observable(new ProjectStore(name))
    createDefaultSuite(newProject)
    loadJSProject(this.state.project, newProject.toJS())
    Logger.clearLogs()
    newProject.setModified(false)
  }
  fetchTests = () => {
    fetch('https://superbot.cloud/api/v1/tests',{
        method: 'GET',
        headers: {
          'Authorization': `Token token="${this.state.user.token}", email="${this.state.user.email}"`
        }
      })
      .then(res => {
        if(res.status === 200){
          return res.json()
        } else {
          return Promise.reject('Error! Failed to fetch tests!')
        }
      })
      .then(body => this.setState({ tests: body.tests }))
      .catch(err => console.log(err))
  }
  submitLogin = (user) => {
    console.log('user:', user)
    const loginBody = Object.keys(user).map(key => encodeURIComponent(key) + '=' + encodeURIComponent(user[key])).join('&');
    console.log(loginBody)
    fetch('http://superbot.cloud/api/v1/sessions', {
      method: 'POST',
      body: loginBody,
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded;charset=UTF-8'
      }
    })
    .then(res => {
      if(res.status === 201){
        return res.json()
      } else {
        return Promise.reject('Error! Failed to login!')
      }
    })
    .then(creds => {
      window.localStorage.setItem('cloud_creds', JSON.stringify(creds))
      this.setState({ user: creds })
      if(this.state.tests === undefined || this.state.tests.length === 0){
        this.fetchTests()
      }
    })
    .catch(err => console.log(err))
  }
  componentDidMount() {
    let creds
    try {
    creds = JSON.parse(window.localStorage.getItem('cloud_creds'))
    console.log('creds:', creds)
    } catch(e) {
      console.log(e)
    }
    if(creds !== null){
      this.setState({ user: creds }, () => {
        if(this.state.tests === undefined || this.state.tests.length === 0){
          this.fetchTests()
        }
      })

    }
  }
  componentWillUnmount() {
    if (isProduction) {
      clearInterval(this.moveInterval)
      window.removeEventListener('resize', this.resizeHandler)
      window.removeEventListener('beforeunload', this.quitHandler)
    }
  }
  render() {
    if(Object.keys(this.state.user).length === 0){
      return (
        <LoginPage submitLogin={this.submitLogin} />
      )
    }
    if(this.state.tests === undefined){
      return (
        <div>
          Loading...
        </div>
      )
    }
    console.log("tests", this.state.tests)
    return (
      <div className="container">
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
                save={() => saveProject(this.state.project)}
                new={this.loadNewProject.bind(this)}
              />
              <div
                className={classNames('content', {
                  dragging: UiState.navigationDragging,
                })}
              >
                <SplitPane
                  split="vertical"
                  minSize={UiState.minNavigationWidth}
                  maxSize={UiState.maxNavigationWidth}
                  size={UiState.navigationWidth}
                  onChange={UiState.resizeNavigation}
                  onDragStarted={this.navigationDragStart}
                  onDragFinished={this.navigationDragEnd}
                >
                  <SuperbotNavigation
                    tests={this.state.tests}
                    suites={this.state.project.suites}
                    duplicateTest={this.state.project.duplicateTestCase}
                  />
                  <textarea
                    autoComplete='off'
                    autoCorrect='off'
                    autoCapitalize='off'
                    spellCheck='false'
                    cols='120'
                    style={{ fontFamily: 'monospace' }}
                  >
                    {this.state.tests.length === 0 ? null : this.state.tests[0].files[0].content}
                  </textarea>
                </SplitPane>
              </div>
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
