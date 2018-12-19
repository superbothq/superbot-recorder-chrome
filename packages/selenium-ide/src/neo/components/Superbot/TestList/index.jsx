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

import React, { Component } from 'react'
import PropTypes from 'prop-types'
import { PropTypes as MobxPropTypes, inject } from 'mobx-react'
import { observer } from 'mobx-react'
import classNames from 'classnames'
import SuperbotTest, { DraggableTest, MenuTest } from '../Test'
import UiState from '../../../stores/view/Superbot/UiState'
import PlaybackState from '../../../stores/view/PlaybackState'
import './style.css'

@inject('renameTest')
@observer
export default class SuperbotTestList extends Component {
  static propTypes = {
    tests: MobxPropTypes.arrayOrObservableArray.isRequired,
    collapsed: PropTypes.bool,
    suite: PropTypes.object,
    renameTest: PropTypes.func,
    duplicateTest: PropTypes.func,
    removeTest: PropTypes.func,
    noMenu: PropTypes.bool,
  }
  render() {
    return (
      <ul className={classNames('tests', { active: !this.props.collapsed })}>
        {this.props.tests.map((test, index) => (
          //TODO: id's for tests
          <li onClick={this.props.saveTestState} key={test.name}>
            {this.props.noMenu ? (
              <SuperbotTest
                key={test.name}
                className={PlaybackState.testState.get(test.id)}
                callstack={
                  PlaybackState.stackCaller === test
                    ? PlaybackState.callstack
                    : undefined
                }
                selectedStackIndex={
                  PlaybackState.stackCaller === test
                    ? UiState.selectedTest.stack
                    : undefined
                }
                index={index}
                test={test}
                suite={this.props.suite}
                selected={
                  UiState.selectedTest &&
                  test.name === UiState.selectedTest.name
                }
                isExecuting={
                  PlaybackState.isPlaying &&
                  PlaybackState.stackCaller &&
                  PlaybackState.stackCaller.id === test.id
                }
                paused={
                  PlaybackState.stackCaller &&
                  PlaybackState.stackCaller.id === test.id &&
                  PlaybackState.paused
                }
                changed={UiState.getTestState(test).modified}
                selectTest={UiState.selectTest}
                moveSelectionUp={() => {
                  UiState.selectTestByIndex(index - 1)
                }}
                moveSelectionDown={() => {
                  UiState.selectTestByIndex(index + 1)
                }}
                setSectionFocus={UiState.setSectionFocus}
              />
            ) : this.props.suite ? (
              <DraggableTest
                className={PlaybackState.testState.get(test.id)}
                index={index}
                test={test}
                suite={this.props.suite}
                selected={
                  UiState.selectedTest &&
                  test.name === UiState.selectedTest.name
                }
                isExecuting={
                  PlaybackState.isPlaying &&
                  PlaybackState.stackCaller &&
                  PlaybackState.stackCaller.id === test.id
                }
                paused={
                  PlaybackState.stackCaller &&
                  PlaybackState.stackCaller.id === test.id &&
                  PlaybackState.paused
                }
                changed={UiState.getTestState(test).modified}
                selectTest={UiState.selectTest}
                removeTest={this.props.removeTest}
                swapTests={this.props.suite.swapTestCases}
                moveSelectionUp={() => {
                  UiState.selectTestByIndex(index - 1, this.props.suite)
                }}
                moveSelectionDown={() => {
                  UiState.selectTestByIndex(index + 1, this.props.suite)
                }}
                setSectionFocus={UiState.setSectionFocus}
              />
            ) : (
              <MenuTest
                key={test.id}
                className={PlaybackState.testState.get(test.id)}
                index={index}
                test={test}
                selected={
                  UiState.selectedTest &&
                  test.name === UiState.selectedTest.name
                }
                isExecuting={
                  PlaybackState.isPlaying &&
                  PlaybackState.stackCaller &&
                  PlaybackState.stackCaller.id === test.id
                }
                paused={
                  PlaybackState.stackCaller &&
                  PlaybackState.stackCaller.id === test.id &&
                  PlaybackState.paused
                }
                changed={UiState.getTestState(test).modified}
                selectTest={UiState.selectTest}
                renameTest={this.props.renameTest}
                duplicateTest={() => {
                  this.props.duplicateTest(test)
                }}
                removeTest={this.props.removeTest}
                moveSelectionUp={() => {
                  UiState.selectTestByIndex(index - 1)
                }}
                moveSelectionDown={() => {
                  UiState.selectTestByIndex(index + 1)
                }}
                setSectionFocus={UiState.setSectionFocus}
              />
            )}
          </li>
        ))}
      </ul>
    )
  }
}
