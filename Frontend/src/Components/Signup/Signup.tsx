import { Link } from 'react-router-dom';
import { auth } from '../../firebase';
import { createUserWithEmailAndPassword } from 'firebase/auth';
import React, { useState, FormEvent } from 'react';
import { useNavigate } from 'react-router-dom';
import './signup.css';

function Signup() {
  const [Name, setName] = useState('');
  const [Email, setEmail] = useState('');
  const [Password, setPassword] = useState('');
  const navigate = useNavigate();

  const Create = async (e: FormEvent) => {
    e.preventDefault();
  
    try {
      const userCredential = await createUserWithEmailAndPassword(auth, Email, Password);
      const user = userCredential.user;
      const uid = user.uid;
  
      const response = await fetch(`${process.env.REACT_APP_API_HOST}/api/start_worker`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json"
        },
        body: JSON.stringify({ firebase_user_id: uid }), 
      });
  
      if (!response.ok) {
        throw new Error("Failed to start worker");
      }
      localStorage.setItem('firebase_user_id', uid);
      navigate('/dashboard');
    } catch (error) {
      console.log(error);
    }
  };
  
  return (
    <section className="signup section" id="signup">
      <div className='signup-container'>
        <h1 className="signup__title">Sign Up</h1>
        <span className="signup__subtitle">Register An Account</span>
 
        <div className='form-container'>
          <h2 className="signup">Create An Account</h2>
          <form onSubmit={Create}>
            <input
              className="name"
              type="text"
              placeholder="Enter Your Name"
              value={Name}
              onChange={(e) => setName(e.target.value)}
            />
            <input
              className="email"
              type="email"
              placeholder="Enter Your Email"
              value={Email}
              onChange={(e) => setEmail(e.target.value)}
            />
            <div className="password-container">
              <input
                className="password"
                type='text'
                placeholder="Enter Your Password"
                value={Password}
                onChange={(e) => setPassword(e.target.value)}
              />
            </div>
            <button className="signup__button" type="submit">
              Sign Up
            </button>
          </form>
         
          <Link to="/login" className="login-toggle">
            <i></i> Already Have An Account? Login!
          </Link>
        </div>
      </div>
    </section>
  );
} 

export default Signup; 