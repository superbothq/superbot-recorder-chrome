import React from 'react'
import PropTypes from 'prop-types'
import { observer } from 'mobx-react'
import { modifier } from 'modifier-keys'
import UiState from '../../../stores/view/Superbot/UiState'
import ToolBar from '../../../components/ToolBar'
import UrlBar from '../../../components/UrlBar'
import TestTable from '../../../components/TestTable'
import CommandForm from '../../../components/CommandForm'
import './style.css'

@observer
export default class SuperbotEditor extends React.Component {
  constructor(props) {
    super(props)
    this.addCommand = this.addCommand.bind(this)
    this.removeCommand = this.removeCommand.bind(this)
    this.state = {
      content: UiState.selectedTest.files ? UiState.selectedTest.files[0].content : null
    }
  }
  static propTypes = {
    test: PropTypes.object,
    callstackIndex: PropTypes.number,
    url: PropTypes.string.isRequired,
    urls: PropTypes.array,
    setUrl: PropTypes.func.isRequired,
  }
  addCommand(index, command) {
    if (command) {
      const newCommand = command.clone()
      this.props.test.insertCommandAt(newCommand, index)
      return newCommand
    } else {
      const newCommand = this.props.test.createCommand(index)
      return newCommand
    }
  }
  removeCommand(index, command) {
    const { test } = this.props
    test.removeCommand(command)
    if (UiState.selectedCommand === command) {
      if (test.commands.length > index) {
        UiState.selectCommand(test.commands[index])
      } else if (test.commands.length) {
        UiState.selectCommand(test.commands[test.commands.length - 1])
      } else {
        UiState.selectCommand(UiState.pristineCommand)
      }
    }
  }
  handleKeyDown(event) {
    const e = event.nativeEvent
    modifier(e)
    const noModifiers = !e.primaryKey && !e.secondaryKey

    if (
      e.target.localName !== 'input' &&
      e.target.localName !== 'textarea' &&
      noModifiers &&
      e.key === 'ArrowLeft'
    ) {
      event.preventDefault()
      event.stopPropagation()
      UiState.focusNavigation()
    }
  }
  render() {
    console.log("ASDASD", UiState.selectedTest)
    console.log("bool", UiState.selectedTest.files !== undefined)
    console.log("file",UiState.selectedTest.files !== undefined ? UiState.selectedTest.files[0].content : null)
    return (
      <div style={{ width: '100%' }}>
        <button
          style={{ display: 'inline-block' }}
          onClick={() => this.props.uploadTest(UiState.selectedTest, this.state.content, this.props.user)}>Upload test!</button>
        <p style={{ display: 'inline-block'}}>Selected test: {UiState.selectedTest ? UiState.selectedTest.name : ''}</p>
        <textarea
          autoComplete='off'
          autoCorrect='off'
          autoCapitalize='off'
          spellCheck='false'
          style={{ 
            fontFamily: 'monospace',
            width: '100%',
            height: '94.7%',
            padding: 0,
            position: 'relative',
            right: '2px'
          }}
          name='content'
          onChange={(event) => this.setState({ [event.target.name]: event.target.value })}
        >
        {this.state.content}
        </textarea>
      </div>
    )
    /*
    return (
      <main className="editor" onKeyDown={this.handleKeyDown.bind(this)}>
        <ToolBar />
        <button onClick={() => uploadTest(this.props.project, this.props.test, this.props.user)}>TEST ME</button>
        <UrlBar
          url={this.props.url}
          urls={this.props.urls}
          setUrl={this.props.setUrl}
        />
        <TestTable
          commands={this.props.test ? this.props.test.commands : null}
          callstackIndex={this.props.callstackIndex}
          selectedCommand={
            UiState.selectedCommand ? UiState.selectedCommand.id : null
          }
          selectCommand={UiState.selectCommand}
          addCommand={this.addCommand}
          removeCommand={this.removeCommand}
          clearAllCommands={
            this.props.test ? this.props.test.clearAllCommands : null
          }
          swapCommands={this.props.test ? this.props.test.swapCommands : null}
        />
        <CommandForm
          command={UiState.selectedCommand}
          setCommand={this.handleCommandChange}
          isSelecting={UiState.isSelectingTarget}
          onSubmit={UiState.selectNextCommand}
        />
      </main>
    )
    */
  }
}
