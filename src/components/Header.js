import React, { useContext, useEffect, useRef, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { FaBars, FaTimes, FaUserCircle, FaGgCircle, FaChevronDown } from 'react-icons/fa';
import { UserContext } from '../contexts/UserContext';
import { TabContext } from '../contexts/TabContext';
import '../styles/Header.css';
import logoImage from '../assets/logo-nobg_resized.png';

const Header = () => {
    const { user, logout } = useContext(UserContext);
    const { setActiveTab } = useContext(TabContext);
    const [menuOpen, setMenuOpen] = useState(false);
    const [dropdownOpen, setDropdownOpen] = useState(false);
    const [mobileNavOpen, setMobileNavOpen] = useState(false);
    const navigate = useNavigate();
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
    const toggleMenu = () => {
        setMenuOpen(!menuOpen);
    };

    const toggleMobileNav = () => {
        setMobileNavOpen(!mobileNavOpen);
    };

    const closeMenu = () => {
        setMenuOpen(false);
    };

    const handleTabClick = (tab) => {
        document.getElementById(tab+'Tab').style.color = 'rgba(240, 96, 29, 1)';
        switch (tab) {
            case 'home':
                document.getElementById('moviesTab').style.color = 'white';
                document.getElementById('showsTab').style.color = 'white';
                document.getElementById('animeTab').style.color = 'white';
                document.getElementById('roomsTab').style.color = 'white';
                break;
            case 'movies':
                document.getElementById('homeTab').style.color = 'white';
                document.getElementById('showsTab').style.color = 'white';
                document.getElementById('animeTab').style.color = 'white';
                document.getElementById('roomsTab').style.color = 'white';
                break;
            case 'shows':
                document.getElementById('homeTab').style.color = 'white';
                document.getElementById('moviesTab').style.color = 'white';
                document.getElementById('animeTab').style.color = 'white';
                document.getElementById('roomsTab').style.color = 'white';
                break;
            case 'anime':
                document.getElementById('homeTab').style.color = 'white';
                document.getElementById('moviesTab').style.color = 'white';
                document.getElementById('showsTab').style.color = 'white';
                document.getElementById('roomsTab').style.color = 'white';
                break;
        }
        setActiveTab(tab);
        navigate('/' + tab);
        closeMenu();
    };

    return (
        <header className="header">
            <div className="left-container">
                <div className="menu-container" onClick={toggleMenu}>
                    {menuOpen ? <FaTimes size={26} /> : <FaBars size={24} />}
                </div>
                {menuOpen && <div className="menu-overlay" onClick={closeMenu}></div>}
                <div className={`slide-menu ${menuOpen ? 'show' : ''}`}>
                    <Link to="/category/action" className="menu-item" onClick={closeMenu}>Action</Link>
                    <Link to="/category/comedy" className="menu-item" onClick={closeMenu}>Comedy</Link>
                    <Link to="/category/drama" className="menu-item" onClick={closeMenu}>Drama</Link>
                    <Link to="/category/horror" className="menu-item" onClick={closeMenu}>Horror</Link>
                </div>
                <nav className="nav-links">
                    <div className="nav-link" id="homeTab"   onClick={() => handleTabClick('home')}>Home</div>
                    <div className="nav-link" id="moviesTab" onClick={() => handleTabClick('movies')}>Movies</div>
                    <div className="nav-link" id="showsTab" onClick={() => handleTabClick('shows')}>Shows</div>
                    <div className="nav-link" id="animeTab" onClick={() => handleTabClick('anime')}>Anime</div>
                    <div className="nav-link" id="roomsTab" onClick={() => handleTabClick('rooms')}>Rooms</div>
                </nav>
            </div>

            <div className="mobile-nav">
                <FaChevronDown size={24} onClick={toggleMobileNav} />
                {mobileNavOpen && (
                    <div className="mobile-nav-menu">
                        <div className="mobile-nav-item" onClick={() => handleTabClick('home')}>Home</div>
                        <div className="mobile-nav-item" onClick={() => handleTabClick('movies')}>Movies</div>
                        <div className="mobile-nav-item" onClick={() => handleTabClick('shows')}>Shows</div>
                        <div className="mobile-nav-item" onClick={() => handleTabClick('anime')}>Anime</div>
                        <div className="mobile-nav-item" onClick={() => handleTabClick('rooms')}>Rooms</div>
                    </div>
                )}
            </div>
            <Link to="/home" className="logo-link">
                <img src={logoImage} alt="Logo" className="logo-image" />
            </Link>
            <div className="right-container">
                <div className="nav-icons">
                    <div className="picker-icon">
                        <FaGgCircle size={30} />
                    </div>
                    <div className="username">Picker</div>
                </div>
                <div className="nav-icons">
                    {user ? (
                        <div className="user-controls" onClick={toggleDropdown}>
                            <FaUserCircle size={30} />
                            <div className="username">{user.user.username}</div>
                            {dropdownOpen && (
                                <div className="dropdown-menu" ref={dropdownRef}>
                                    <div className="dropdown-item" onClick={handleLogout}>Logout</div>
                                    <div className="dropdown-item" onClick={() => navigate('/profile')}>Profile</div>
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
            </div>
        </header>
    );
};

export default Header;
