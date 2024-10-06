import React, { useContext, useEffect, useRef, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { FaChevronDown, FaUserCircle } from 'react-icons/fa';
import { UserContext } from '../../contexts/UserContext';
import { TabContext } from '../../contexts/TabContext';
import '../../styles/components/Header.css';
import logoImage from '../../utils/logo-nobg_resized.png';
import searchImage from '../../utils/search.png';
import userIcon from '../../utils/profile.png';
import { useLoading } from '../../contexts/LoadingContext';

const Header = ({ onSearchClick }) => {
  const { user, logout } = useContext(UserContext);
  const { activeTab, setActiveTab } = useContext(TabContext);
  const { isLoading } = useLoading();
  const [dropdownOpen, setDropdownOpen] = useState(false);
  const [mobileNavOpen, setMobileNavOpen] = useState(false);
  const navigate = useNavigate();
  const dropdownRef = useRef(null);

  useEffect(() => {
    const handleClickOutside = (event) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target)) {
        setDropdownOpen(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const handleLogout = () => logout();

  const toggleMobileNav = () => setMobileNavOpen(!mobileNavOpen);

  const handleTabClick = (tab) => {
    setActiveTab(tab);
    navigate('/' + tab);
    setDropdownOpen(false);
  };

  const renderNavLink = (tab, title) => (
    <div
      className={`nav-link ${activeTab === tab ? 'active-tab' : ''}`}
      onClick={() => handleTabClick(tab)}
      title={title}
    >
      {tab.charAt(0).toUpperCase() + tab.slice(1)}
    </div>
  );

  const renderMobileNavItem = (tab) => (
    <div className='mobile-nav-item' onClick={() => handleTabClick(tab)}>
      {tab.charAt(0).toUpperCase() + tab.slice(1)}
    </div>
  );

  return (
    <>
      {isLoading && <div className='loading-indicator' />}
      <header className='header'>
        <div className='left-container'>
          <img
            src={logoImage}
            alt='Logo'
            className='logo-image'
            onClick={() => document.scrollingElement.scrollTop}
          />
          <nav className='nav-links'>
            {['home', 'movies', 'shows', 'anime'].map((tab) =>
              renderNavLink(
                tab,
                `Go to ${tab} ${tab === 'home' ? 'page' : 'only section'}`,
              ),
            )}
          </nav>
          <div className='mobile-nav'>
            <FaChevronDown size={24} onClick={toggleMobileNav} />
            {mobileNavOpen && (
              <div className='mobile-nav-menu' ref={dropdownRef}>
                {['home', 'movies', 'shows', 'anime'].map(renderMobileNavItem)}
              </div>
            )}
          </div>
        </div>
        <div className='right-container'>
          <div className='nav-icons'>
            <div
              className='user-controls'
              onClick={onSearchClick}
              title='Show or hide the search bar'
            >
              <img
                className='search-icon'
                src={searchImage}
                alt='search icon'
              />
              <div className='username'>Search</div>
            </div>
          </div>
          <div className='nav-icons'>
            {user ? (
              <div
                className='user-controls'
                onClick={() => setDropdownOpen(!dropdownOpen)}
                title='User settings'
              >
                <img className='search-icon' src={userIcon} alt='user icon' />
                <div className='username'>{user.user.username}</div>
                {dropdownOpen && (
                  <div className='dropdown-menu'>
                    <div className='dropdown-item' onClick={handleLogout}>
                      Logout
                    </div>
                  </div>
                )}
              </div>
            ) : (
              <Link to='/login'>
                <div className='login-container'>
                  <FaUserCircle size={24} />
                  <span>Login</span>
                </div>
              </Link>
            )}
          </div>
        </div>
      </header>
    </>
  );
};

export default Header;
