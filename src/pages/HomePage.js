import React, {useContext, useState} from 'react';
import {UserContext} from '../contexts/UserContext';
import '../styles/HomePage.css';
import ParticleBackground from '../components/ParticleBackground';
import Header from "../components/Header";


const HomePage = () => {
    const {user, logout} = useContext(UserContext);
    const [activeTab, setActiveTab] = useState('Movies');


    return (
      <>
          <Header/>
     <ParticleBackground/>
    <div className="navbar">
        <button onClick={() => setActiveTab('Movies')} className="button fire"><span>Movies</span></button>
        <button onClick={() => setActiveTab('Shows')} className="button ice"><span>Shows</span></button>
        <button onClick={() => setActiveTab('Animes')} className="button fire"><span>Animes</span></button>
        <button onClick={() => setActiveTab('Rooms')} className="button ice"><span>Rooms</span></button>
    </div>
    <div className="content">
        {renderContent()}
    </div>
      </>
    );
};

export default HomePage;
