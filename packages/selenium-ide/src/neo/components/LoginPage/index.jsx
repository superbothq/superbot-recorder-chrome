import React, { Component } from 'react'
import './style.css'

class LoginPage extends Component {
  waitForLogin = () => {
    this.loginInterval = setInterval(this.props.handleLogin, 1000)
  }

  componentWillUnmount(){
    clearInterval(this.loginInterval)
  }

  render() {
    return (
      <div className='login-form'>
        {/*
        <img
          src='../robot_face.png'
          alt='robot_face'
        />
        */}
        <h2>Superbot Recorder</h2>
        <br/>

        <a
          href='https://superbot.cloud/login'
          target='_blank'
        >
          <button onClick={this.waitForLogin}>
            Login
          </button>
        </a>

        <p>
          Don't have an account?
          <a
            href='https://superbot.cloud/signup'
            target='_blank'
            onClick={this.waitForLogin}
          >
            Create one here!
          </a>
        </p>
      </div>
    )
  }
}

export default LoginPage
