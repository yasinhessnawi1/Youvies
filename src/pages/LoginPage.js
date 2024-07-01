// src/pages/LoginPage.js

import React, { useContext, useState } from 'react';
import { useHistory } from 'react-router-dom';
import ParticleBackground from '../components/ParticleBackground';
import '../styles/LoginPage.css';
import { UserContext } from '../contexts/UserContext';
import NameParticles from "../components/NameParticles";

const LoginPage = () => {
    const { login } = useContext(UserContext);
    const [username, setUsername] = useState('');
    const [password, setPassword] = useState('');
    const history = useHistory();

    const handleLogin = async (e) => {
        e.preventDefault();
        try {
            await login(username, password);
            history.push('/home');
        } catch (error) {
            alert('Login failed: ' + error.message);
        }
    };

    return (
        <div className="login-page">
            <ParticleBackground />
            <NameParticles text="Youvies" logoSrc="/logo.png" />
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
                        <button type="button" className="button ice" onClick={() => history.push("/")}><span>Cancel</span></button>
                    </div>
                </form>
            </div>
        </div>
    );
};

export default LoginPage;
