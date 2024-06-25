import React, { useContext } from 'react';
import ParticleBackground from '../components/ParticleBackground';
import NameParticles from '../components/NameParticles';
import '../styles/LandingPage.css';
import { UserContext } from '../contexts/UserContext';
import { useHistory } from 'react-router-dom';

const LandingPage = () => {
    const { user, logout } = useContext(UserContext);
    const history = useHistory();

    return (
        <div className="landing-page">
            <div className="canvas-container">
                <NameParticles />
                <ParticleBackground />
            </div>
            <div className="container_name">
                <div className="text-logo">
                    <span className="text">Youvies</span>
                    <img src="./../assets/logo.png" alt="Logo" className="logo" />
                </div>
            </div>
            <div className="container">
                {user ? (
                    <>
                        <a href="#" className="button fire"><span>Movie</span></a>
                        <a href="#" className="button ice"><span>Show</span></a>
                        <a href="#" className="button fire"><span>Anime</span></a>
                        <a href="#" className="button ice"><span>Join Room</span></a>
                        <a href="#" className="button fire" onClick={logout}><span>Logout</span></a>
                    </>
                ) : (
                    <>
                        <a href="#" className="button fire" onClick={() => history.push('/login')}><span>Login</span></a>
                        <a href="#" className="button ice"><span>Invitation</span></a>
                        <a href="#" className="button fire"><span>Join Room</span></a>
                    </>
                )}
            </div>
        </div>
    );
};

export default LandingPage;
