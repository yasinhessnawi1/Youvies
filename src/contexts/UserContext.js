// src/contexts/UserContext.js

import React, { createContext, useState, useEffect } from 'react';
import { loginUser, logoutUser } from '../api/UserApi';
import {useHistory} from "react-router-dom";

// Create Context
export const UserContext = createContext(undefined, undefined);

// UserProvider Component
export const UserProvider = ({ children }) => {
    const [user, setUser] = useState(null);
    const history = useHistory();
    useEffect(() => {
        // Check if user is logged in (e.g., via a token in localStorage)
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
            if (user.user && user.token) {
                await logoutUser(user.token);
            }
            setUser(null);
            localStorage.removeItem('user');
            history.push('/');
        } catch (error) {
            console.error('Logout failed:', error);
        }
    };

    return (
        <UserContext.Provider value={{ user, login, logout }}>
            {children}
        </UserContext.Provider>
    );
};
