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

import React from 'react'
import PropTypes from 'prop-types'
import classNames from 'classnames'
import Title from 'react-document-title'
import ContentEditable from 'react-contenteditable'
import { observer } from 'mobx-react'
import PlaybackState from '../../stores/view/PlaybackState'
import UiState from '../../stores/view/UiState'
import NewButton from '../ActionButtons/New'
//import OpenButton from '../ActionButtons/Open'
import SaveButton from '../ActionButtons/Save'
//import MoreButton from '../ActionButtons/More'
//import ListMenu, { ListMenuItem } from '../ListMenu'
//import { showChangelog } from '../Changelog'
import { parse } from 'modifier-keys'
import GaugeMenu from '../GaugeMenu'
import SpeedGauge from '../ActionButtons/SpeedGauge'
import PlayCurrent from '../ActionButtons/PlayCurrent'
import BetterRecord from '../ActionButtons/BetterRecord'
import Stop from '../ActionButtons/Stop'
import Pause from '../ActionButtons/Pause'
import Clear from '../ActionButtons/Clear'
import LogoutButton from '../ActionButtons/Logout'

import './style.css'

@observer
export default class ProjectHeader extends React.Component {
  constructor(props) {
    super(props)
    this.handleKeyDown = this.handleKeyDown.bind(this)
    this.handleChange = this.handleChange.bind(this)
  }
  static propTypes = {
    title: PropTypes.string.isRequired,
    changed: PropTypes.bool,
    changeName: PropTypes.func.isRequired,
    openFile: PropTypes.func,
    load: PropTypes.func,
    save: PropTypes.func,
    new: PropTypes.func,
  }
  playAll = () => {
    const isInSuiteView = UiState.selectedView === 'Test suites'

    if (PlaybackState.canPlaySuite) {
      this.props.disableUploadWarning();
      PlaybackState.playSuiteOrResume()
    } else if (isInSuiteView) {
      ModalState.showAlert({
        title: 'Select a test case',
        description:
          'To play a suite you must select a test case from within that suite.',
      })
    } else {
      this.props.disableUploadWarning();
      PlaybackState.playFilteredTestsOrResume()
    }
  }
  handleKeyDown(e) {
    if (e.key === 'Enter') {
      e.preventDefault()
      e.target.blur()
    }
  }
  handleChange(e) {
    this.props.changeName(e.target.value)
    UiState.selectedTest.test.name = e.target.value
  }
  render() {
    return (
      <div className={classNames('header', { changed: this.props.changed })}>
        <Title
          title={`Superbot Recorder ${this.props.title === '' ? '' : '-'} ${
            this.props.title
          }${this.props.changed ? '*' : ''}`}
        />
        <div>
          <span className="title-prefix">Test: </span>
          <ContentEditable
            className="title"
            onKeyDown={this.handleKeyDown}
            onChange={this.handleChange}
            html={this.props.title}
          />
          <i className="si-pencil" />
        </div>
        <span className="buttons">
          <a className='testlist-link'
            href={`https://superbot.cloud/organizations/${this.props.organizationId}/tests`}
            target="_blank"
          >
            Test List
          </a>
          <BetterRecord
            disabled={PlaybackState.isPlaying}
            isRecording={UiState.isRecording}
            onClick={UiState.toggleSuperbotRecording}
          />
          <div
            className='button-separator'
            style={{
              borderLeft: '1px solid #ccc',
              padding: '10px 0 10px 0',
              margin: '0 7px 0 10px',
              width: 'initial',
              height: 'initial'
            }}
          />
          {PlaybackState.isPlaying ? (
            <Stop
              onClick={() => {
                PlaybackState.abortPlaying()
              }}
            />
          ) : (
            <PlayCurrent
              isActive={!PlaybackState.paused && PlaybackState.isPlayingTest}
              disabled={UiState.isRecording}
              onClick={this.playAll}
              style={{
                fontSize: 26,
                border: 0,
                margin: '0 5px 0 5px',
                width: 'initial',
                height: 'initial'
              }}
            />
          )}
          {PlaybackState.isPlaying ? (
            <Pause
              isActive={PlaybackState.paused}
              data-tip={
                !PlaybackState.paused
                  ? `<p>Pause test execution <span style="color: #929292;padding-left: 5px;">${parse(
                      'p',
                      { primaryKey: true }
                    )}</span></p>`
                  : `<p>Resume test execution <span style="color: #929292;padding-left: 5px;">${parse(
                      'p',
                      { primaryKey: true }
                    )}</span></p>`
              }
              onClick={PlaybackState.pauseOrResume}
              style={{
                marginRight: '10px'
              }}
            />
          ) : null}


          <GaugeMenu
            opener={<SpeedGauge
                      speed={UiState.gaugeSpeed}
                      style={{
                        fontSize: 26,
                        padding: 0,
                        border: 0,
                        margin: '0 10px 0 0',
                        width: 'initial',
                        height: 'initial'
                      }}
                    />}
            value={PlaybackState.delay}
            maxDelay={PlaybackState.maxDelay}
            onChange={PlaybackState.setDelay}
          />
          <Clear
            data-tip='<p>Clear commands</p>'
            onClick={this.props.clearAllCommands}
            style={{
              margin: '0 2px 0 6px'
            }}
          />
          <div
            className='button-separator'
            style={{
              borderLeft: '1px solid #ccc',
              padding: '10px 0 10px 0',
              margin: '0 7px 0 10px',
              width: 'initial',
              height: 'initial'
            }}
          />
          <NewButton
            onClick={this.props.new}
            style={{
              border: 0,
              margin: '0 0 0 10px',
              width: 'initial',
              height: 'initial'
            }}
          />
          <SaveButton
            unsaved={this.props.changed}
            onClick={this.props.save}
            style={{
              fontSize: 24,
              border: 0,
              margin: '0 0 0 10px',
              width: 'initial',
              height: 'initial'
            }}
          />
          <LogoutButton
            onClick={this.props.logout}
            style={{
              color: '#656565',
              fontSize: '20px',
              marginLeft: '7px'
            }}
          />
        </span>
      </div>
    )
  }
}
