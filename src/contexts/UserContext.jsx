// UserContext.jsx

import React, { createContext, useState, useEffect, useContext } from 'react';
import { loginUser, logoutUser, editUser } from '../api/UserApi';
import { useNavigate } from 'react-router-dom';
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
      if (user && user.token) {
       let watched = user.user.watched;
        if(watched.length > 30){
            watched = watched.slice(watched.length - 30, watched.length);
            user.user.watched = watched
        }
        await editUser(user.user, user.token);
        await logoutUser(user.token);
      }
      setUser(null);
      localStorage.removeItem('user');
      navigate('/login');
    } catch (error) {
      alert('An error occurred while logging out. Please try again.'); // Display a user-friendly alert
      console.error('Logout error:', error); // Log the error for debugging
    }
  };

  const updateUser = async (watchedList) => {
    if(watchedList){
        user.user.watched = watchedList;
    }
    try {
      localStorage.setItem('user', JSON.stringify(user));
        await editUser(user.user, user.token);
    } catch (error) {
      console.error('Failed to update user:', error);
    }
  }

  const addToWatchedList = async (watchedItem) => {
    if (!user) return;

    // Initialize watched list if it doesn't exist
    if (!user.user.watched) user.user.watched = [];

    // Parse the watched item details
    const [type, id, title] = watchedItem.split(':');

    // Find the existing watched item
    const existingItemIndex = user.user.watched.findIndex((item) =>
      item.startsWith(`${type}:${id}:${title}`),
    );
    if (existingItemIndex !== -1) {
        // Update the existing item
        user.user.watched.remove(existingItemIndex);
    }
     // New item, add it to the watched list
     user.user.watched.push(watchedItem);

    localStorage.setItem('user', JSON.stringify(user));
    try {
      await editUser(user.user, user.token);
    } catch (error) {
      console.error('Failed to update user watched list:', error);
    }
  };

  const getWatchedItem = (type, id, title) => {
    if (!user || !user.user.watched) return null;
    return (
      user.user.watched.find((item) =>
        item.startsWith(`${type}:${id}:${title}`),
      ) || null
    );
  };


  return (
    <UserContext.Provider
      value={{ user, login, logout, addToWatchedList, getWatchedItem , updateUser}}
    >
      {children}
    </UserContext.Provider>
  );
};
