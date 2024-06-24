import React from 'react';
import ParticleBackground from '../components/ParticleBackground';
import '../styles/LandingPage.css';

const LandingPage = () => {
    return (
        <div className="landing-page">
            <ParticleBackground />
            <div className="container">
                <a href="#">
                    <div className="sun"></div>
                    <div className="button"><span>Login</span></div>
                </a>
                <a href="#">
                    <div className="sun"></div>
                    <div className="button"><span>Invitation</span></div>
                </a>
                <a href="#">
                    <div className="sun"></div>
                    <div className="button"><span>Join Room</span></div>
                </a>
            </div>
        </div>
    );
};

export default LandingPage;
