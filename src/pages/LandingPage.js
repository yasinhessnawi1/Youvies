import React, { useContext, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import ParticleBackground from '../components/ParticleBackground';
import NameParticles from '../components/NameParticles';
import '../styles/LandingPage.css';
import { UserContext } from '../contexts/UserContext';

const LandingPage = () => {
    const { user } = useContext(UserContext);
    const navigate = useNavigate();

    useEffect(() => {
        if (user) {
            navigate('/home');
        }
    }, [user, navigate]);

    return (
        <div className="landing-page">
            <div className="canvas-container">
                <NameParticles text="Youvies" logoSrc="/logo.png" />
                <ParticleBackground />
            </div>
            <div className="button-container">
                <a href="/login" className="button fire" onClick={() => navigate('/login')}>
                    <span>Login</span>
                </a>
                <a href="/" className="button ice">
                    <span>Invitation</span>
                </a>
                <a href="/" className="button fire">
                    <span>Join Room</span>
                </a>
            </div>
        </div>
    );
};

export default LandingPage;
