import React from 'react'
import ActionButton from '../ActionButton'
import classNames from 'classnames'

export default class Logout extends React.Component {
  render() {
    return (
      <ActionButton
        data-place='left'
        data-tip={'<p>(Temp.)Log out</p>'}
        {...this.props}
        className={classNames('si-open-tab', this.props.className)}
      /> // eslint-disable-line react/prop-types
    )
  }
}
