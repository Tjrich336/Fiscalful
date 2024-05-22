import React, { useState, FormEvent } from 'react';
import { auth } from '../../firebase';
import { signInWithEmailAndPassword } from 'firebase/auth';
import { Link, useNavigate } from 'react-router-dom'; // Add useNavigate
import { library } from '@fortawesome/fontawesome-svg-core';
import { faEye, faEyeSlash } from '@fortawesome/free-solid-svg-icons';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import './login.css';

// Add icons to the library
library.add(faEye, faEyeSlash);

function Login() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState('');
  const navigate = useNavigate(); // Add this line

  const togglePasswordVisibility = () => {
    setShowPassword(!showPassword);
  };

  const signIn = async (e: FormEvent) => {
    e.preventDefault();
  
    try {
      const userCredential = await signInWithEmailAndPassword(auth, email, password);
      const user = userCredential.user;
      const uid = user.uid;
      console.log(",aasd", uid);
      const response = await fetch(`${process.env.REACT_APP_API_HOST}/api/start_worker`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json"
        },
        body: JSON.stringify({ firebase_user_id: uid }), // Send data as JSON
      });
  
      if (!response.ok) {
        throw new Error("Failed to start worker");
      }
      localStorage.setItem('firebase_user_id', uid); // store uid in local storage for authentication

      navigate('/dashboard'); // Add this line
    } catch (error) {
      setError('Email and password combination do not match!');
      console.log(error);
    }
  };
  

  return (
    <section className="login section" id="login">
      <div className='login-container'>
        <h1 className="login__title">Log In</h1>
        <span className="login__subtitle">Register An Account</span>
 
 
        <div className='form-container'>
          <h2 className="login">Log Into Your Account</h2>
          <form onSubmit={signIn}>
            <input
              className="email"
              type="email"
              placeholder="Enter Your Email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
            />
            <div className="password-container">
              <input
                className="password"
                type={showPassword ? 'text' : 'password'}
                placeholder="Enter Your Password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
              />
              {error && <p className="error">{error}</p>}
              {password && (
                <FontAwesomeIcon
                  icon={showPassword ? faEyeSlash : faEye}
                  className="password-toggle"
                  onClick={togglePasswordVisibility}
                />
              )}
            </div>
            <button className="login__button" type="submit">
              Log In
            </button>
          </form>
       
          <Link to="/signup" className="register">
            <i></i> Don't Have An Account? Register Today!
          </Link>
        </div>
      </div>
    </section>
  ); 
}
export default Login;