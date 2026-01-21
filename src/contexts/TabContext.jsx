import React, { createContext, useState, useEffect } from 'react';

export const TabContext = createContext();

const VALID_TABS = ['home', 'movies', 'shows', 'anime', 'iptv', 'random'];

export const TabProvider = ({ children }) => {
  // Initialize from URL hash or localStorage, default to 'home'
  const getInitialTab = () => {
    // Check URL hash first (e.g., #movies, #shows, #anime, #random)
    const hash = window.location.hash.replace('#', '');
    if (VALID_TABS.includes(hash)) {
      return hash;
    }
    // Fall back to localStorage
    const savedTab = localStorage.getItem('activeTab');
    if (savedTab && VALID_TABS.includes(savedTab)) {
      return savedTab;
    }
    return 'home';
  };

  const [activeTab, setActiveTab] = useState(getInitialTab);

  // Update localStorage and URL hash when tab changes
  useEffect(() => {
    localStorage.setItem('activeTab', activeTab);
    // Update URL hash without triggering navigation
    if (activeTab !== 'home') {
      window.history.replaceState(null, '', `#${activeTab}`);
    } else {
      // Remove hash for home tab
      window.history.replaceState(null, '', window.location.pathname);
    }
  }, [activeTab]);

  // Listen for hash changes (browser back/forward)
  useEffect(() => {
    const handleHashChange = () => {
      const hash = window.location.hash.replace('#', '');
      if (VALID_TABS.includes(hash)) {
        setActiveTab(hash);
      } else if (!hash) {
        setActiveTab('home');
      }
    };

    window.addEventListener('hashchange', handleHashChange);
    return () => window.removeEventListener('hashchange', handleHashChange);
  }, []);

  return (
    <TabContext.Provider value={{ activeTab, setActiveTab }}>
      {children}
    </TabContext.Provider>
  );
};
