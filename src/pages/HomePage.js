import React, { useState } from 'react';
import '../styles/HomePage.css';
import ParticleBackground from '../components/ParticleBackground';
import Header from "../components/Header";
import Banner from "../components/Banner";
import VideoCardGrid from "../components/VideoCardGrid";
import Footer from "../components/Footer";

const HomePage = () => {
    const [activeTab, setActiveTab] = useState('home');

    const renderBannerContentType = () => {
        switch (activeTab) {
            case 'movies':
                return 'movies';
            case 'shows':
                return 'shows';
            case 'anime':
                return 'anime';
            default:
                return 'movies';
        }
    };

    const renderContent = () => {
        switch (activeTab) {
            case 'movies':
                return <VideoCardGrid contentType="movies" />;
            case 'shows':
                return <VideoCardGrid contentType="shows" />;
            case 'anime':
                return <VideoCardGrid contentType="anime" />;
            case 'rooms':
                // Implement rooms content if needed
                return <div>Rooms Content</div>;
            case 'home':
            default:
                return (
                    <>
                        <VideoCardGrid contentType="movies" />
                        <VideoCardGrid contentType="shows" />
                        <VideoCardGrid contentType="anime" />
                    </>
                );
        }
    };

    return (
        <>
            <ParticleBackground />
            <div className="home-page">
                <Header setActiveTab={setActiveTab} />
                <Banner contentType={renderBannerContentType()} />
                <div className="content">
                    {renderContent()}
                </div>
                <Footer />
            </div>
        </>
    );
};

export default HomePage;
