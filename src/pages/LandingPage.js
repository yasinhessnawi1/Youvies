import React, { useEffect, useContext } from 'react';
import { useNavigate } from 'react-router-dom';
import '../styles/LandingPage.css';
import { UserContext } from '../contexts/UserContext';
import StarryBackground from "../components/StarryBackground";

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
            <StarryBackground />
            <div className="landing-container">
                <div className="logo">
                    <img src="/logo-nobg.png" alt="logo" />
                </div>
                <div className="button-container">
                    <button className="button fire" onClick={() => navigate('/login')}><span>Login</span></button>
                    <button className="button ice"><span>Invitation</span></button>
                    <button className="button fire"><span>Join Room</span></button>
                </div>
            </div>
        </div>
    );
};

export default LandingPage;
