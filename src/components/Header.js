import React, { useContext, useEffect, useRef, useState } from 'react';
import { Link, useHistory } from 'react-router-dom';
import { FaBars, FaTimes, FaUserCircle } from 'react-icons/fa';
import { UserContext } from '../contexts/UserContext';
import '../styles/Header.css'; // Ensure path is correct
import logoImage from '../assets/logo.png'; // Ensure path is correct

const Header = () => {
    const { user, logout } = useContext(UserContext);
    const [menuOpen, setMenuOpen] = useState(false);
    const [dropdownOpen, setDropdownOpen] = useState(false);
    const navigate = useHistory();
    const dropdownRef = useRef(null);

    useEffect(() => {
        function handleClickOutside(event) {
            if (dropdownRef.current && !dropdownRef.current.contains(event.target)) {
                setDropdownOpen(false);
            }
        }

        document.addEventListener('mousedown', handleClickOutside);
        return () => {
            document.removeEventListener('mousedown', handleClickOutside);
        };
    }, [dropdownRef]);

    const handleLogout = () => {
        logout();
        navigate('/login');
    };

    const toggleDropdown = () => setDropdownOpen(!dropdownOpen);
    const toggleMenu = (event) => {
        event.stopPropagation();
        setMenuOpen(!menuOpen);
    };

    const closeMenu = () => {
        setMenuOpen(false);
    };

    const handleNavigatingToProfile = () => {
        navigate('/profile');
    };

    return (
        <header className="header">
            <div className="menu-container" onClick={toggleMenu}>
                {menuOpen ? <FaTimes size={24} /> : <FaBars size={24} />}
                <span>Menu</span>
            </div>
            <Link to="/" className="logo-link">
                <img src={logoImage} alt="Logo" className="logo-image" />
                <div className="logo-text">Youvies</div>
            </Link>
            <div className="nav-icons">
                {user ? (
                    <div className="user-controls" onClick={toggleDropdown}>
                        <FaUserCircle size={24} />
                        <span>{user.username}</span>
                        {dropdownOpen && (
                            <div className="dropdown-menu" ref={dropdownRef}>
                                <div className="dropdown-item" onClick={handleLogout}>Logout</div>
                                <div className="dropdown-item" onClick={handleNavigatingToProfile}>Profile</div>
                            </div>
                        )}
                    </div>
                ) : (
                    <Link to="/login">
                        <div className="login-container">
                            <FaUserCircle size={24} />
                            <span>Login</span>
                        </div>
                    </Link>
                )}
            </div>
            {menuOpen && <div className="menu-overlay" onClick={closeMenu}></div>}
            <div className={`slide-menu ${menuOpen ? 'show' : ''}`}>
                <Link to="/" className="menu-item" onClick={closeMenu}>Home</Link>
                <Link to="/movies" className="menu-item" onClick={closeMenu}>Movies</Link>
                <Link to="/shows" className="menu-item" onClick={closeMenu}>Shows</Link>
                <Link to="/animes" className="menu-item" onClick={closeMenu}>Animes</Link>
                <Link to="/rooms" className="menu-item" onClick={closeMenu}>Rooms</Link>
            </div>
        </header>
    );
};

export default Header;
