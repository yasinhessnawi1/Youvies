import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import StarryBackground from '../components/static/StarryBackground';
import '../styles/page/LoginPage.css';
import { useAuth } from '../contexts/AuthContext';
import { useLoading } from '../contexts/LoadingContext';
import LoadingIndicator from '../components/static/LoadingIndicator';
import { FaEye, FaEyeSlash } from 'react-icons/fa';
import ItemsGrid from '../components/LoginBg';

const LoginPage = () => {
  const { signIn, signUp, user, loading } = useAuth();
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [email, setEmail] = useState('');
  const [errorMessage, setErrorMessage] = useState('');
  const navigate = useNavigate();
  const { isLoading, setIsLoading } = useLoading();
  const [isPasswordVisible, setIsPasswordVisible] = useState(false);
  const [isFlipped, setIsFlipped] = useState(false);

  // Check if user is already logged in
  useEffect(() => {
    if (!loading && user) {
      navigate('/home');
    }
  }, [user, loading, navigate]);

  const handleLogin = async (e) => {
    e.preventDefault();
    setIsLoading(true);
    setErrorMessage('');
    try {
      await signIn(email, password);
      setIsLoading(false);
      navigate('/home');
    } catch (error) {
      setErrorMessage('Login failed: ' + error.message);
      setIsLoading(false);
    }
  };

  const handleSignUp = async (e) => {
    e.preventDefault();
    setIsLoading(true);
    setErrorMessage('');
    try {
      await signUp(email, password, username);
      // After signup, automatically sign in
      await signIn(email, password);
      setIsLoading(false);
      navigate('/home');
    } catch (error) {
      setErrorMessage('Sign-up failed: ' + error.message);
      setIsLoading(false);
    }
  };

  const togglePasswordVisibility = (e) => {
    e.stopPropagation();
    setIsPasswordVisible((prevState) => !prevState);
  };

  const handleToggleChange = (e) => {
    e.stopPropagation(); // Stop the event from propagating up
    setErrorMessage('');
    setIsFlipped((prevState) => !prevState);
  };

  return (
    <>
      {isLoading && <LoadingIndicator />}
      <div className='login-page'>
        <ItemsGrid />
        <StarryBackground />
        <div className='login-container'>
          <div className='wrapper'>
            <div className='card-switch'>
              <div className='switch'>
                <span className='slider' onClick={handleToggleChange}></span>{' '}
                {/* Attach onClick only to the slider */}
                <span className='card-side'></span>
                <div
                  className={`flip-card__inner ${isFlipped ? 'flipped' : ''}`}
                >
                  <div className='flip-card__front'>
                    <div className='logo'>
                      <img src='/logo-nobg_resized.png' alt='logo' />
                    </div>
                    <div className='title'>Log in</div>
                    <form onSubmit={handleLogin} className='flip-card__form'>
                      <input
                        type='email'
                        value={email}
                        autoComplete={'email'}
                        onChange={(e) => setEmail(e.target.value)}
                        placeholder='Email'
                        name='email'
                        className='flip-card__input'
                        required
                      />
                      <div className='password-input-wrapper'>
                        <input
                          type={isPasswordVisible ? 'text' : 'password'}
                          value={password}
                          autoComplete={'current-password'}
                          onChange={(e) => setPassword(e.target.value)}
                          placeholder='Password'
                          name='password'
                          className='flip-card__input'
                          required
                        />
                        <button
                          type='button'
                          className='toggle-password-visibility'
                          onClick={togglePasswordVisibility}
                          aria-label='Toggle password visibility'
                        >
                          {isPasswordVisible ? (
                            <FaEyeSlash size={24} />
                          ) : (
                            <FaEye size={24} />
                          )}
                        </button>
                      </div>
                      <button type='submit' className='flip-card__btn'>
                        Let’s go!
                      </button>
                      {errorMessage && (
                        <p className='error-message'>{errorMessage}</p>
                      )}
                    </form>
                  </div>
                  <div className='flip-card__back'>
                    <div className='logo'>
                      <img src='/logo-nobg_resized.png' alt='logo' />
                    </div>
                    <div className='title' onClick={handleToggleChange}>Sign up</div>
                    <form onSubmit={handleSignUp} className='flip-card__form'>
                      <input
                        type='text'
                        placeholder='Username'
                        name='name'
                        className='flip-card__input'
                        value={username}
                        autoComplete={'username'}
                        onChange={(e) => setUsername(e.target.value)}
                        required
                      />
                        <input
                          type={isPasswordVisible ? 'text' : 'password'}
                          value={password}
                          autoComplete={'current-password'}
                          onChange={(e) => setPassword(e.target.value)}
                          placeholder='Password'
                          name='password'
                          className='flip-card__input'
                          required
                        />

                      <input
                        type='input'
                        placeholder='Email'
                        name='email'
                        value={email}
                        onChange={(e) => setEmail(e.target.value)}
                        className='flip-card__input'
                        required
                      />
                      <button type='submit' className='flip-card__btn'>
                        Confirm!
                      </button>
                      {errorMessage && (
                        <p className='error-message'>{errorMessage}</p>
                      )}
                    </form>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </>
  );
};

export default LoginPage;
