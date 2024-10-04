import React from 'react';
import './../styles/components/Button.css';
import { useNavigate } from 'react-router-dom'; // Ensure you create this file and add the styles below

const Button = ({ text, onClick, title, id = '', category }) => {
  const navigate = useNavigate();
  if (text.toString().toLowerCase().includes('info')) {
    onClick = () => navigate(`/info/${id}/${category}`);
  }
  return (
    <button type='button' className='btn' onClick={onClick} title={title}>
      <strong>{text}</strong>
      <div id='container-stars'>
        <div id='stars'></div>
      </div>
      <div id='glow'>
        <div className='circle'></div>
        <div className='circle'></div>
      </div>
    </button>
  );
};

export default Button;
