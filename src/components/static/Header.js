import React, { useContext, useEffect, useRef, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { FaChevronDown, FaTimes, FaUserCircle } from 'react-icons/fa';
import { UserContext } from '../../contexts/UserContext';
import { TabContext } from '../../contexts/TabContext';
import '../../styles/components/Header.css';
import logoImage from '../../utils/logo-nobg_resized.png';
import hamburgerImage from '../../utils/menu.png';
import searchImage from '../../utils/search.png';
import userIcon from '../../utils/profile.png';
import {useLoading} from "../../contexts/LoadingContext";

const Header = ({ onSearchClick }) => {
    const { user, logout } = useContext(UserContext);
    const { activeTab, setActiveTab } = useContext(TabContext);
    const [menuOpen, setMenuOpen] = useState(false);
    const [dropdownOpen, setDropdownOpen] = useState(false);
    const [mobileNavOpen, setMobileNavOpen] = useState(false);
    const navigate = useNavigate();
    const dropdownRef = useRef(null);
    const {isLoading} = useLoading();

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
        setActiveTab(tab);
        navigate('/' + tab);
        closeMenu();
    };

    return (
        <header className="header">
            <div className="left-container">
                {isLoading && <div className="loading-indicator" />}
                <img src={logoImage} alt="Logo" className="logo-image" />
                <nav className="nav-links">
                    <div
                        className={`nav-link ${activeTab === 'home' ? 'active-tab' : ''}`}
                        onClick={() => handleTabClick('home')}
                        title="Go to home page"
                    >
                        Home
                    </div>
                    <div
                        className={`nav-link ${activeTab === 'movies' ? 'active-tab' : ''}`}
                        onClick={() => handleTabClick('movies')}
                        title="Go to movies only section"
                    >
                        Movies
                    </div>
                    <div
                        className={`nav-link ${activeTab === 'shows' ? 'active-tab' : ''}`}
                        onClick={() => handleTabClick('shows')}
                        title="Go to shows only section"
                    >
                        Shows
                    </div>
                    <div
                        className={`nav-link ${activeTab === 'anime' ? 'active-tab' : ''}`}
                        onClick={() => handleTabClick('anime')}
                        title="Go to anime only section"
                    >
                        Anime
                    </div>
                </nav>
                <div className="mobile-nav">
                    <FaChevronDown size={24} onClick={toggleMobileNav} />
                    {mobileNavOpen && (
                        <div className="mobile-nav-menu">
                            <div className="mobile-nav-item" onClick={() => handleTabClick('home')}>Home</div>
                            <div className="mobile-nav-item" onClick={() => handleTabClick('movies')}>Movies</div>
                            <div className="mobile-nav-item" onClick={() => handleTabClick('shows')}>Shows</div>
                            <div className="mobile-nav-item" onClick={() => handleTabClick('anime')}>Anime</div>
                        </div>
                    )}
                </div>
            </div>
            <div className="right-container">
                <div className="nav-icons">
                    <div className="user-controls" onClick={onSearchClick} title="Show or hide the search bar">
                        <img className="search-icon" src={searchImage} alt={"search icon"} />
                        <div className="username">Search</div>
                    </div>
                </div>
                <div className="nav-icons">
                    {user ? (
                        <div className="user-controls" onClick={() => setDropdownOpen(!dropdownOpen)} title="User settings">
                            <img className="search-icon" src={userIcon} alt={"search icon"} />
                            <div className="username">{user.user.username}</div>
                            {dropdownOpen && (
                                <div className="dropdown-menu">
                                    <div className="dropdown-item" onClick={handleLogout}>Logout</div>
                                    <div className="dropdown-item" onClick={() => navigate('/')}>Profile</div>
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
                <div className="menu-container" onClick={toggleMenu}>
                    {menuOpen ? <FaTimes size={45} className="nav-link" /> :
                        <img src={hamburgerImage} height={45} alt={"hamburger menu"} title={"Menu with extra features"} className="nav-link" />}
                </div>
                {menuOpen && <div className="menu-overlay" onClick={closeMenu}></div>}
                <div className={`slide-menu ${menuOpen ? 'show' : ''}`}>
                    <FaTimes size={24} className="nav-link" onClick={closeMenu} />
                    <Link to="#" className="menu-item" onClick={closeMenu}>Coming soon... </Link>
                </div>
            </div>
        </header>
    );
};

export default Header;
