import React, { useContext, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import StarryBackground from "../components/StarryBackground";
import '../styles/LoginPage.css';
import { UserContext } from '../contexts/UserContext';

const LoginPage = () => {
    const { login } = useContext(UserContext);
    const [username, setUsername] = useState('');
    const [password, setPassword] = useState('');
    const navigate = useNavigate();

    const handleLogin = async (e) => {
        e.preventDefault();
        try {
            await login(username, password);
            navigate('/home');
        } catch (error) {
            alert('Login failed: ' + error.message);
        }
    };

    return (
        <div className="login-page">
            <StarryBackground />
            <div className="login-container">
                <div className="logo">
                    <img src="/logo-nobg.png" alt="logo" />
                </div>
                <div className="login-card">
                    <h2>Login</h2>
                    <form onSubmit={handleLogin}>
                        <input
                            type="text"
                            placeholder="Username"
                            value={username}
                            onChange={(e) => setUsername(e.target.value)}
                        />
                        <input
                            type="password"
                            placeholder="Password"
                            value={password}
                            onChange={(e) => setPassword(e.target.value)}
                        />
                        <div className="login-button-container">
                            <button type="submit" className="button fire"><span>Login</span></button>
                            <button type="button" className="button ice" onClick={() => navigate('/')}><span>Cancel</span></button>
                        </div>
                    </form>
                </div>
            </div>
        </div>
    );
};

export default LoginPage;
