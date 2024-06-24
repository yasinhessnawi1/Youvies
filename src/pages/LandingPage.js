import React from 'react';
import ParticleBackground from '../components/ParticleBackground';
import '../styles/LandingPage.css';

const LandingPage = () => {
    return (
        <div className="landing-page">
            <ParticleBackground/>
            <div className="container">
                <a href="google.com" className="button fire"><span>Login</span></a>
                <a href="#" className="button ice"><span>Invitation</span></a>
                <a href="#" className="button fire"><span>Join Room</span></a>
            </div>
        </div>
    );
};

export default LandingPage;
