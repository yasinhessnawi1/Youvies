import React from 'react';
import { BrowserRouter as Router, Route, Routes } from 'react-router-dom';
import LoginPage from './pages/LoginPage';
import HomePage from './pages/HomePage';
import RandomPage from './pages/RandomPage';
import IptvPage from './pages/IptvPage';
import { AuthProvider } from './contexts/AuthContext';
import { UserProvider } from './contexts/UserContext';
import { TorrentProvider } from './contexts/TorrentContext';
import { VideoPlayerProvider } from './contexts/VideoPlayerContext';
import { ItemProvider } from './contexts/ItemContext';
import { LoadingProvider } from './contexts/LoadingContext';
import { TabProvider } from './contexts/TabContext';
import ErrorBoundary from './components/static/ErrorBoundary';
import InfoPage from './pages/InfoPage';

function App() {
  return (
    <Router>
      <ErrorBoundary>
        <AuthProvider>
          <UserProvider>
            <TorrentProvider>
              <VideoPlayerProvider>
                <ItemProvider>
                  <LoadingProvider>
                    <TabProvider>
                      <Routes>
                          <Route path='/login' element={<LoginPage />} />
                          <Route
                            path='/info/:category/:mediaId'
                            element={<InfoPage />}
                          />
                          <Route path='/home' element={<HomePage />} />
                          <Route path='/movies' element={<HomePage />} />
                          <Route path='/shows' element={<HomePage />} />
                          <Route path='/anime' element={<HomePage />} />
                          <Route path='/TV' element={<IptvPage />} />
                          <Route path='/random' element={<RandomPage />} />
                          <Route path='/' element={<LoginPage />} />
                          <Route path='*' element={<LoginPage />} />
                        </Routes>
                    </TabProvider>
                  </LoadingProvider>
                </ItemProvider>
              </VideoPlayerProvider>
            </TorrentProvider>
          </UserProvider>
        </AuthProvider>
      </ErrorBoundary>
    </Router>
  );
}

export default App;
