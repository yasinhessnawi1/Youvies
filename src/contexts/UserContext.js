// UserContext.js

import React, { createContext, useState, useEffect } from 'react';
import { loginUser, logoutUser, editUser } from '../api/UserApi';
import { useNavigate } from "react-router-dom";

export const UserContext = createContext();

export const UserProvider = ({ children }) => {
    const [user, setUser] = useState(null);
    const navigate = useNavigate();

    useEffect(() => {
        const loggedUser = localStorage.getItem('user');
        if (loggedUser) {
            setUser(JSON.parse(loggedUser));
        }
    }, []);

    const login = async (username, password) => {
        try {
            const userData = await loginUser(username, password);
            setUser(userData);
            localStorage.setItem('user', JSON.stringify(userData));
        } catch (error) {
            throw new Error('Invalid username or password');
        }
    };

    const logout = async () => {
        try {
            console.table(user);

            if (user && user.token) {
                await editUser(user.user, user.token);
                await logoutUser(user.token);
            }
            console.table(user);
            setUser(null);
            localStorage.removeItem('user');
            navigate('/');
        } catch (error) {
            console.error('Logout failed:', error);
        }
    };

    const addToWatchedList = (watchedItem) => {
        if (!user) return;

        // Initialize watched list if it doesn't exist
        if (!user.user.watched) user.user.watched = [];

        // Parse the watched item details
        const [type, title, newSeason, newEpisode] = watchedItem.split(':');

        // Find the existing watched item
        const existingItemIndex = user.user.watched.findIndex(item => item.startsWith(`${type}:${title}`));

        if (existingItemIndex !== -1) {
            // Replace with updated values
            user.user.watched[existingItemIndex] = `${type}:${title}:${newSeason}:${newEpisode}`;
        } else {
            // New item, add it to the watched list
            user.user.watched.push(watchedItem);
        }

        // Update the user state and persist to localStorage
        setUser(user);
        localStorage.setItem('user', JSON.stringify(user));
    };



    const getWatchedItem = (type, title) => {
        if (!user || !user.user.watched) return null;
        return user.user.watched.find(item => item.startsWith(`${type}:${title}`)) || null;
    };

    return (
        <UserContext.Provider value={{ user, login, logout, addToWatchedList, getWatchedItem }}>
            {children}
        </UserContext.Provider>
    );
};
