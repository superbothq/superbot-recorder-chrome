import React from 'react'
import PropTypes from 'prop-types'
import ActionButton from '../ActionButton'
import './style.css'

export default class BetterRecord extends React.Component {
  static propTypes = {
    isRecording: PropTypes.bool,
    disabled: PropTypes.bool,
    onClick: PropTypes.func,
  }
  render() {
    return (
      <div
        className="record"
        data-place='left'
        data-tip={'<p>(Superbot) Record a test</p>'}
      >
        <ActionButton
          disabled={this.props.disabled}
          isActive={this.props.isRecording}
          onClick={this.props.onClick}
          className="si-record"
          style={{
            color: '#018fe3'
          }}
        />
      </div>
    )
  }
}
