import React, { useContext, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import StarryBackground from "../components/static/StarryBackground";
import '../styles/page/LoginPage.css';
import { UserContext } from '../contexts/UserContext';
import { registerUser } from "../api/UserApi";
import { useLoading } from "../contexts/LoadingContext";
import LoadingIndicator from "../components/static/LoadingIndicator";

const LoginPage = () => {
    const { login } = useContext(UserContext);
    const [username, setUsername] = useState('');
    const [password, setPassword] = useState('');
    const [email, setEmail] = useState('');
    const [invitationCode, setInvitationCode] = useState(''); // Invitation code state
    const [errorMessage, setErrorMessage] = useState(''); // Error message state
    const navigate = useNavigate();
    const { isLoading, setIsLoading } = useLoading();
    if (localStorage.getItem('user')) {
        navigate('/home');
    }
    const handleLogin = async (e) => {
        e.preventDefault();
        setIsLoading(true);
        setErrorMessage(''); // Clear any previous errors

        try {
            await login(username, password);
            if (localStorage.getItem('user')) navigate('/home');
        } catch (error) {
            setErrorMessage('Login failed: ' + error.message);
            setIsLoading(false);
        }
        setIsLoading(false);
    };

    const handleSignUp = async (e) => {
        e.preventDefault();
        setIsLoading(true);
        setErrorMessage(''); // Clear any previous errors

        try {
            // Check if the invitation code is correct
            if (invitationCode !== 'once-in-a-lifetime-experience-i-love-youvies-2024') {
                setErrorMessage('Invalid invitation code.');
                setIsLoading(false);
                return;
            }

            let newUser = {
                username: username,
                password: password,
                email: email
            };
            await registerUser(newUser);
            await handleLogin(e);
        } catch (error) {
            setErrorMessage('Sign-up failed: ' + error.message);
            setIsLoading(false);
        }
        setIsLoading(false);
    };

    const handleToggleChange = () => {
        setErrorMessage(''); // Clear the error message when switching between login and sign-up forms
    };



    return (
        <div className="login-page">
            <StarryBackground />
            {isLoading && <LoadingIndicator />} {/* Show Loading Indicator when loading */}

            <div className="login-container">
                <div className="logo">
                    <img src="/logo-nobg.png" alt="logo" />
                </div>
                <div className="wrapper">
                    <div className="card-switch">
                        <label className="switch">
                            <input className="toggle" type="checkbox" onChange={handleToggleChange} />
                            <span className="slider"></span>
                            <span className="card-side"></span>
                            <div className="flip-card__inner">
                                <div className="flip-card__front">
                                    <div className="title">Log in</div>
                                    <form onSubmit={handleLogin} className="flip-card__form">
                                        <input
                                            type="text"
                                            value={username}
                                            autoComplete={'username'}
                                            onChange={(e) => setUsername(e.target.value)}
                                            placeholder="Username"
                                            name="username"
                                            className="flip-card__input"
                                            required
                                        />
                                        <input
                                            type="password"
                                            value={password}
                                            autoComplete={'current-password'}
                                            onChange={(e) => setPassword(e.target.value)}
                                            placeholder="Password"
                                            name="password"
                                            className="flip-card__input"
                                            required
                                        />
                                        <button type="submit" className="flip-card__btn">Let’s go!</button>
                                        {errorMessage && <p className="error-message">{errorMessage}</p>} {/* Display error message */}
                                    </form>
                                </div>
                                <div className="flip-card__back">
                                    <div className="title">Sign up</div>
                                    <form onSubmit={handleSignUp} className="flip-card__form">
                                        <input
                                            type="text"
                                            placeholder="Username"
                                            name="name"
                                            className="flip-card__input"
                                            value={username}
                                            autoComplete={'username'}
                                            onChange={(e) => setUsername(e.target.value)}
                                            required
                                        />
                                        <input
                                            type="email"
                                            placeholder="Email"
                                            name="email"
                                            value={email}
                                            onChange={(e) => setEmail(e.target.value)}
                                            className="flip-card__input"
                                            required
                                        />
                                        <input
                                            type="password"
                                            placeholder="Password"
                                            name="password"
                                            autoComplete={'new-password'}
                                            value={password}
                                            onChange={(e) => setPassword(e.target.value)}
                                            className="flip-card__input"
                                            required
                                        />
                                        <input
                                            type="text"
                                            placeholder="Invitation Code"
                                            name="invitationCode"
                                            value={invitationCode}
                                            onChange={(e) => setInvitationCode(e.target.value)}
                                            className="flip-card__input"
                                            required
                                        />
                                        <button type="submit" className="flip-card__btn">Confirm!</button>
                                        {errorMessage && <p className="error-message">{errorMessage}</p>} {/* Display error message */}
                                    </form>
                                </div>
                            </div>
                        </label>
                    </div>
                </div>
            </div>
        </div>
    );
};

export default LoginPage;
