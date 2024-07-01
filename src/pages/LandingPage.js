import React, { useContext, useEffect } from 'react';
import { useHistory } from 'react-router-dom';
import ParticleBackground from '../components/ParticleBackground';
import NameParticles from '../components/NameParticles';
import '../styles/LandingPage.css';
import { UserContext } from '../contexts/UserContext';

const LandingPage = () => {
    const { user } = useContext(UserContext);
    const history = useHistory();

    useEffect(() => {
        if (user) {
            history.push('/home');
        }
    }, [user, history]);

    return (
        <div className="landing-page">
            <div className="canvas-container">
                <NameParticles text="Youvies" logoSrc="/logo.png" />
                <ParticleBackground />
            </div>
            <div className="button-container">
                <a href="/login" className="button fire" onClick={() => history.push('/login')}>
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
