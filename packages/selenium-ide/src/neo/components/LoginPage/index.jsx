import React from 'react'
import './style.css'

const LoginPage = (props) => (
  <div className='supahbot-login-form'>
    <img src='../robot_face.png' alt='robot_face' style={{ width: 50, display: 'inline-block', marginLeft: 5, float: 'left' }} />
    <h2 style={{ display: 'inline-block', marginBottom: 10, marginTop: 12, marginRight: 60, float: 'right' }}>Superbot Recorder</h2>
    <br/>


    <a href="https://superbot.cloud/login" target='_blank'><button id='login-form-button' onClick={props.handleLogin}>Login</button></a>

    <p style={{ color: 'black', fontSize: 16 }}>Don't have an account? <a href="https://superbot.cloud/signup" target='_blank' style={{ color: 'steelblue' }}>Create one here!</a></p>
  </div>
)

export default LoginPage
