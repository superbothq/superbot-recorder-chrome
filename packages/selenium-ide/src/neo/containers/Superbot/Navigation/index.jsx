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
import { PropTypes } from 'prop-types'
import { observer, Provider } from 'mobx-react'
import { PropTypes as MobxPropTypes } from 'mobx-react'
import { modifier } from 'modifier-keys'
import UiState from  '../../../stores/view/Superbot/UiState'
import ModalState from '../../../stores/view/ModalState'
import PlaybackState from '../../../stores/view/PlaybackState'
import SuperbotVerticalTabBar from '../../../components/Superbot/VerticalTabBar'
import SearchBar from '../../../components/SearchBar'
import SuperbotTestList from '../../../components/Superbot/TestList'
import ExecutionPlan from '../../../components/ExecutionPlan'
import Runs from '../../../components/Runs'
import AddButton from '../../../components/ActionButtons/Add'
import './style.css'

@observer
export default class Navigation extends React.Component {
  constructor(props) {
    super(props)
    this.handleChangedTab = this.handleChangedTab.bind(this)
  }
  static propTypes = {
    suites: MobxPropTypes.arrayOrObservableArray.isRequired,
    tests: MobxPropTypes.arrayOrObservableArray.isRequired,
    duplicateTest: PropTypes.func,
  }
  handleChangedTab(tab) {
    if (PlaybackState.isPlaying && !PlaybackState.paused) {
      ModalState.showAlert(
        {
          title: 'Playback is Running',
          description:
            "Can't change the view while playback is running, pause the playback?",
          confirmLabel: 'Pause',
          cancelLabel: 'Cancel',
        },
        choseChange => {
          if (choseChange) {
            PlaybackState.pause()
            UiState.changeView(tab)
          }
        }
      )
    } else {
      UiState.changeView(tab)
    }
  }
  componentDidMount() {
    UiState.changeView('Tests')
  }
  handleKeyDown(event) {
    const e = event.nativeEvent
    modifier(e)
    const noModifiers = !e.primaryKey && !e.secondaryKey

    if (
      e.target.localName !== 'input' &&
      noModifiers &&
      e.key === 'ArrowRight'
    ) {
      event.preventDefault()
      event.stopPropagation()
      UiState.focusEditor()
    }
  }
  render() {
    console.log("uistate", UiState.selectedView)
    return (
      <aside
        className="test-cases"
        onKeyDown={this.handleKeyDown.bind(this)}
        onMouseEnter={() => UiState.setNavigationHover(true)}
        onMouseLeave={() => UiState.setNavigationHover(false)}
      >
        <SuperbotVerticalTabBar
          tabs={UiState.views}
          tab='Tests'
          tabChanged={this.handleChangedTab}
          defaultTab='Tests'
        >
          {UiState.selectedView === 'Tests' && (
            <AddButton
              data-tip={'<p>Add new test</p>'}
              onClick={this.props.createTest}
              //onClick={ModalState.createTest}
            />
          )}
        </SuperbotVerticalTabBar>
        <Provider renameTest={ModalState.renameTest}>
          <React.Fragment>
            {UiState.selectedView === 'Tests' && (
              <React.Fragment>
                <SearchBar
                  value={UiState.filterTerm}
                  filter={UiState.changeFilter}
                />
                <SuperbotTestList
                  tests={this.props.tests}
                  duplicateTest={this.props.duplicateTest}
                  removeTest={this.props.removeTest}
                  saveTestState={this.props.saveTestState}
                />
              </React.Fragment>
            )}
            {UiState.selectedView === 'Executing' && (
              <React.Fragment>
                <ExecutionPlan />
                <Runs
                  runs={PlaybackState.finishedTestsCount}
                  failures={PlaybackState.failures}
                  hasError={!!PlaybackState.failures}
                  progress={PlaybackState.finishedTestsCount}
                  totalProgress={PlaybackState.testsCount}
                />
              </React.Fragment>
            )}
          </React.Fragment>
        </Provider>
      </aside>
    )
  }
}
