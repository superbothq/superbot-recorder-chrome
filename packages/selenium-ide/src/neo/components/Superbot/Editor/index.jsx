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
      content: UiState.selectedTest.content ? UiState.selectedTest.content : UiState.selectedTest.files ? UiState.selectedTest.files[0].content : null
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
  componentDidUpdate() {
    UiState.selectedTest.content = this.state.content
  }
  render() {
    return (
      <div style={{ width: '100%' }}>
        <textarea
          autoComplete='off'
          autoCorrect='off'
          autoCapitalize='off'
          spellCheck='false'
          style={{ 
            fontFamily: 'monospace',
            width: '100%',
            height: '100%'
          }}
          name='content'
          onChange={(event) => this.setState({ [event.target.name]: event.target.value })}
        >
        {this.state.content}
        </textarea>
      </div>
    )
  }
}
