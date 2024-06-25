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
                <NameParticles text="Youvies" logoSrc="/logo.png" />
                <ParticleBackground />
            </div>
            <div className="container">
                {user ? (
                    <>
                        <a href="#" className="button fire" onClick={()=> history.push('/home/movie')}><span>Movie</span></a>
                        <a href="#" className="button ice" onClick={()=> history.push('/home/show')}><span>Show</span></a>
                        <a href="#" className="button fire" onClick={()=> history.push('/home/anime')}><span>Anime</span></a>
                        <a href="#" className="button ice" onClick={()=> history.push('/home/room')}><span>Join Room</span></a>
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
