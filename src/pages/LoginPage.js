import React, {useContext, useState} from 'react';
import {useNavigate} from 'react-router-dom';
import StarryBackground from "../components/static/StarryBackground";
import '../styles/page/LoginPage.css';
import {UserContext} from '../contexts/UserContext';
import {registerUser} from "../api/UserApi";
import {useLoading} from "../contexts/LoadingContext";
import LoadingIndicator from "../components/static/LoadingIndicator";

const LoginPage = () => {
    const {login} = useContext(UserContext);
    const [username, setUsername] = useState('');
    const [password, setPassword] = useState('');
    const [email, setEmail] = useState('');
    const navigate = useNavigate();
    const { isLoading, setIsLoading } = useLoading(); // Use LoadingContext

    const handleLogin = async (e) => {
        e.preventDefault();
        setIsLoading(true);
        try {
            await login(username, password);
            navigate('/home');
        } catch (error) {
            alert('Login failed: ' + error.message);
        }
        setIsLoading(false);
    };
    const handleSignUp = async (e) => {
        e.preventDefault();
        setIsLoading(true);
        try {
            let newUser = {
                username: username,
                password: password,
                email: email
            }
            await registerUser(newUser);
            await handleLogin(e);
        } catch (error) {
            alert('Login failed: ' + error.message);
        }
        setIsLoading(false);
    };
    if (localStorage.getItem('user')) {
        navigate('/home');
    }
    return (
        <div className="login-page">
            {isLoading && <LoadingIndicator />} {/* Show Loading Indicator when loading */}
            <StarryBackground/>
            <div className="login-container">
                <div className="logo">
                    <img src="/logo-nobg.png" alt="logo"/>
                </div>
                <div className="wrapper">
                    <div className="card-switch">
                        <label className="switch">
                            <input className="toggle" type="checkbox"/>
                            <span className="slider"></span>
                            <span className="card-side"></span>
                            <div className="flip-card__inner">
                                <div className="flip-card__front">
                                    <div className="title">Log in</div>
                                    <form onSubmit={handleLogin} className="flip-card__form"
                                    >
                                        <input type="text" value={username}
                                               onChange={(e) => setUsername(e.target.value)} placeholder="Username"
                                               name="username" className="flip-card__input" required/>
                                        <input type="password" value={password}
                                               onChange={(e) => setPassword(e.target.value)} placeholder="Password"
                                               name="password" className="flip-card__input" required/>
                                        <button type="submit" className="flip-card__btn" value={username}>Let’s go!
                                        </button>
                                    </form>
                                </div>
                                <div className="flip-card__back">
                                    <div className="title">Sign up</div>
                                    <form onSubmit={handleSignUp} className="flip-card__form">
                                        <input type="text" placeholder="Username" name="name" className="flip-card__input"
                                               value={username}
                                               onChange={(e) => setUsername(e.target.value)}
                                               required/>
                                        <input type="email" placeholder="Email" name="email"
                                               value={email}
                                               onChange={(e) => setEmail(e.target.value)}
                                               className="flip-card__input" required/>
                                        <input type="password" placeholder="Password" name="password"
                                               value={password}
                                               onChange={(e) => setPassword(e.target.value)}
                                               className="flip-card__input" required/>
                                        <button type="submit" className="flip-card__btn">Confirm!</button>
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
