import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App'; // Assuming App.jsx is in the same directory
import '../Global.css'; // Import global styles

ReactDOM.createRoot(document.getElementById('root')).render(
    <React.StrictMode>
        <App />
    </React.StrictMode>
);
