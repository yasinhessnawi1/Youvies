// src/api/UserApi.js



import {BASE_URL} from "./apiHelpers";

export const loginUser = async (username, password) => {
    try {

        const response = await fetch(`${BASE_URL}/api/login`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },

            body: JSON.stringify({ username, password}),
        });

        if (!response.ok) {
            throw new Error('Login failed');
        }

        return await response.json();
    } catch (error) {
        console.error('Error logging in:', error);
        throw error;
    }
};

export const registerUser = async (user) => {
    try {
        const response = await fetch(`${BASE_URL}/api/register`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify(user),
        });

        if (!response.ok) {
            const error = await response.json();
            throw new Error('Registration failed ' + error.error);
        }

        return await response.json();
    } catch (error) {
        console.error('Error registering:', error);
        throw error;
    }
};

export const editUser = async (user, token) => {
    try {
        const response = await fetch(`${BASE_URL}/api/user?id=${user.id}`, {
            method: 'PUT',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${token}`,
            },
            body: JSON.stringify(user),
        });

        if (!response.ok) {
            throw new Error('Edit user failed');
        }

        return await response.json();
    } catch (error) {
        console.error('Error editing user:', error);
        throw error;
    }
};

export const logoutUser = async (token) => {
    try {
        const response = await fetch(`${BASE_URL}/api/logout`, {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${token}`,
            },
        });

        if (!response.ok) {
            throw new Error('Logout failed');
        }

        return true;
    } catch (error) {
        console.error('Error logging out:', error);
        throw error;
    }
};
