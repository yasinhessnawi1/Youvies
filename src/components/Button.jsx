import React from 'react';
import { HoverButton } from '@/components/ui/hover-button';
import { useNavigate } from 'react-router-dom';

const Button = ({ text, onClick, title, id = '', category, ...props }) => {
  const navigate = useNavigate();
  if (text && text.toString().toLowerCase().includes('info')) {
    onClick = () => navigate(`/info/${category}/${id}`);
  }
  return (
    <HoverButton onClick={onClick} title={title} {...props}>
      {text}
    </HoverButton>
  );
};

export default Button;
