import React from 'react';
import './../styles/components/Button.css'; // Ensure you create this file and add the styles below

const Button = ({ text, onClick , title}) => {
    return (
        <button type="button" className="btn" onClick={onClick} title={title}>
            <strong>{text}</strong>
            <div id="container-stars">
                <div id="stars"></div>
            </div>
            <div id="glow">
                <div className="circle"></div>
                <div className="circle"></div>
            </div>
        </button>
    );
};

export default Button;
