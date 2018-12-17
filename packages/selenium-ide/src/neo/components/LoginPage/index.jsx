import React, { Component } from 'react'
import './style.css'

class LoginPage extends Component {
  constructor() {
    super()
    this.state = {
      email: '',
      password: ''
    }
  }

  changeField = (event) => {
    this.setState({ [event.target.name]: event.target.value })
  }

    render() {
      return (
        <div className='supahbot-login-form'>
          <img src='../robot_face.png' alt='robot_face' style={{ width: 50, display: 'inline-block', marginLeft: 5, float: 'left' }} />
          <h2 style={{ display: 'inline-block', marginBottom: 10, marginTop: 12, marginRight: 60, float: 'right' }}>Superbot Recorder</h2>
          <input style={{ fontSize: 20, marginTop: 20, marginBottom: 10, borderRadius: 10, padding: 5, paddingLeft: 10 }} placeholder='email' name='email' value={this.state.email} onChange={(event) => this.changeField(event)} />
          <br/>
          <input style={{ fontSize: 20, borderRadius: 10, padding: 5, paddingLeft: 10 }} placeholder='password' name='password' value={this.state.password} type='password' onChange={(event) => this.changeField(event)} />
          <br/>
          <button id='login-form-button' onClick={() => this.props.submitLogin({ email: this.state.email, password: this.state.password })}>Login</button>
          <p style={{ color: 'black', fontSize: 16 }}>Don't have an account? <a href="https://superbot.cloud/signup" target='_blank' style={{ color: 'steelblue' }}>Create one here!</a></p>
        </div>
      )
    }
}

export default LoginPage
