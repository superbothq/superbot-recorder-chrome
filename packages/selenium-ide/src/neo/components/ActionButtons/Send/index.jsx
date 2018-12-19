import React from 'react'
import ActionButton from '../ActionButton'
import classNames from 'classnames'

export default class SendButton extends React.Component {
  render() {
    const props = { ...this.props }
    return (
      <ActionButton
        data-tip={`<p>Create new project <span style="color: #929292;padding-left: 5px;"></span></p>`}
        {...props}
        className={classNames('si-send', this.props.className)}
      /> // eslint-disable-line react/prop-types
    )
  }
}
