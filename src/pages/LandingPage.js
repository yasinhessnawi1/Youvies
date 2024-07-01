import React, { useEffect, useContext } from 'react';
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
                <button className="button fire" onClick={() => navigate('/login')}><span>Login</span></button>
                <button className="button ice"><span>Invitation</span></button>
                <button className="button fire"><span>Join Room</span></button>
            </div>
        </div>
    );
};

export default LandingPage;
