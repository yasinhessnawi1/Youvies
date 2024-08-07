import React from 'react';
import { BrowserRouter as Router, Route, Routes } from 'react-router-dom';
import LandingPage from './pages/LandingPage';
import LoginPage from './pages/LoginPage';
import HomePage from './pages/HomePage';
import { UserProvider } from './contexts/UserContext';
import { VideoPlayerProvider } from './contexts/VideoPlayerContext';
import { ItemProvider } from './contexts/ItemContext';
import { LoadingProvider } from './contexts/LoadingContext';
import { TabProvider } from './contexts/TabContext';
import VideoPlayer from './components/VideoPlayer';
import './styles/Global.css';
import ErrorBoundary from "./components/ErrorBoundary";

function App() {
    return (
        <Router>
            <ErrorBoundary>
            <UserProvider>
                <VideoPlayerProvider>
                    <ItemProvider>
                        <LoadingProvider>
                            <TabProvider>
                                <Routes>
                                    <Route path="/login" element={<LoginPage />} />
                                    <Route path="/home" element={<HomePage />} />
                                    <Route path="/movies" element={<HomePage />} />
                                    <Route path="/shows" element={<HomePage />} />
                                    <Route path="/anime" element={<HomePage />} />
                                    <Route path="/" element={<LandingPage />} />
                                    <Route path="*" element={<LandingPage />} />
                                </Routes>
                                <VideoPlayer />
                            </TabProvider>
                        </LoadingProvider>
                    </ItemProvider>
                </VideoPlayerProvider>
            </UserProvider>
            </ErrorBoundary>
        </Router>
    );
}

export default App;
