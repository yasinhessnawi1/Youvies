import React from 'react';
import { BrowserRouter as Router, Routes, Route } from 'react-router-dom';
import LandingPage from './pages/LandingPage';
import LoginPage from './pages/LoginPage';
import HomePage from './pages/HomePage';
import { UserProvider } from './contexts/UserContext';
import './styles/Global.css';

function App() {
    return (
        <Router>
            <UserProvider>
                <Routes>
                    <Route path="/login" element={<LoginPage />} />
                    <Route path="/home" element={<HomePage />} />
                    <Route path="/" element={<LandingPage />} />
                    <Route path="*" element={<LandingPage />} />
                </Routes>
            </UserProvider>
        </Router>
    );
}

export default App;
