import React, { createContext, useState, useEffect } from 'react';
import { loginUser, logoutUser, editUser } from '../api/UserApi';
import { useNavigate } from "react-router-dom";

export const UserContext = createContext(undefined, undefined);

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
            if (user && user.token) {
               // await editUser(user, user.token);
                await logoutUser(user.token);
            }
            setUser(null);
            localStorage.removeItem('user');
            navigate('/');
        } catch (error) {
            console.error('Logout failed:', error);
        }
    };

    const addToWatchedList = async (watchedItem) => {
        if (!user) return;

        const updatedUser = { ...user, watched: user.watched || [] };

        if (!updatedUser.watched.includes(watchedItem)) {
           // updatedUser.watched.a(watchedItem);
            setUser(updatedUser);
            localStorage.setItem('user', JSON.stringify(updatedUser));
        }
        try {
            //await editUser(updatedUser, user.token);
        } catch (error) {
            console.error('Error updating watched list:', error);
        }
    };

    return (
        <UserContext.Provider value={{ user, login, logout, addToWatchedList }}>
            {children}
        </UserContext.Provider>
    );
};
