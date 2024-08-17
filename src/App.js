import React from 'react';
import {BrowserRouter as Router, Route, Routes} from 'react-router-dom';
import LandingPage from './saved/LandingPage';
import LoginPage from './pages/LoginPage';
import HomePage from './pages/HomePage';
import {UserProvider} from './contexts/UserContext';
import {VideoPlayerProvider} from './contexts/VideoPlayerContext';
import {ItemProvider} from './contexts/ItemContext';
import {LoadingProvider} from './contexts/LoadingContext';
import {TabProvider} from './contexts/TabContext';
import VideoPlayer from './components/VideoPlayer';
import './styles/Global.css';
import ErrorBoundary from "./components/static/ErrorBoundary";
import InfoPage from "./pages/InfoPage";

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
                                        <Route path="/login" element={<LoginPage/>}/>
                                        <Route path="/info/:mediaId/:category" element={<InfoPage />} />
                                        <Route path="/home" element={<HomePage/>}/>
                                        <Route path="/movies" element={<HomePage/>}/>
                                        <Route path="/shows" element={<HomePage/>}/>
                                        <Route path="/anime" element={<HomePage/>}/>
                                        <Route path="/" element={<LoginPage/>}/>
                                        <Route path="*" element={<LoginPage/>}/>
                                    </Routes>
                                    <VideoPlayer/>
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
