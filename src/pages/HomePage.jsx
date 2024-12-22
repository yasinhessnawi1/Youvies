import React, { useEffect, useRef, useState } from 'react';
import '../styles/page/HomePage.css';
import Header from '../components/static/Header';
import Banner from '../components/Banner';
import VideoCardGrid from '../components/Carousel';
import Footer from '../components/static/Footer';
import StarryBackground from '../components/static/StarryBackground';
import LoadingIndicator from '../components/static/LoadingIndicator';
import SearchBar from '../components/SearchBar';
import { TabContext } from '../contexts/TabContext';
import { useItemContext } from '../contexts/ItemContext';

const HomePage = () => {
  const { activeTab } = React.useContext(TabContext);
  const [isSearchVisible, setIsSearchVisible] = useState(false); // New state to manage search bar visibility

  const {
    isLoading,
    items,
    genres,
    selectedGenre,
    setSelectedGenre,
    setGenres,
    fetchAllItems,
    watchedItems,
  } = useItemContext();

  const hasFetched = useRef(false);
  useEffect(() => {
    setIsSearchVisible(false);
  }, [activeTab]);

  useEffect(() => {
    if (
      !hasFetched.current &&
      !items['movies-home'] &&
      !items['shows-home'] &&
      !items['anime-home']
    ) {
      fetchAllItems();
      hasFetched.current = true;
    }
  }, [fetchAllItems]);

  useEffect(() => {
    if (activeTab !== 'home') {
      const loadGenres = () => {
        let genresData = [];
        switch (activeTab) {
          case 'movies':
            genresData = [
              { id: 28, name: 'Action' },
              { id: 12, name: 'Adventure' },
              { id: 16, name: 'Animation' },
              { id: 35, name: 'Comedy' },
              { id: 80, name: 'Crime' },
              { id: 99, name: 'Documentary' },
              { id: 18, name: 'Drama' },
              { id: 10751, name: 'Family' },
              { id: 14, name: 'Fantasy' },
              { id: 36, name: 'History' },
              { id: 27, name: 'Horror' },
              { id: 10402, name: 'Music' },
              { id: 9648, name: 'Mystery' },
              { id: 10749, name: 'Romance' },
              { id: 878, name: 'Science Fiction' },
              { id: 10770, name: 'TV Movie' },
              { id: 53, name: 'Thriller' },
              { id: 10752, name: 'War' },
              { id: 37, name: 'Western' },
            ];
            break;
          case 'shows':
            genresData = [
              { id: 10759, name: 'Action & Adventure' },
              { id: 16, name: 'Animation' },
              { id: 35, name: 'Comedy' },
              { id: 80, name: 'Crime' },
              { id: 99, name: 'Documentary' },
              { id: 18, name: 'Drama' },
              { id: 10751, name: 'Family' },
              { id: 10762, name: 'Kids' },
              { id: 9648, name: 'Mystery' },
              { id: 10763, name: 'News' },
              { id: 10764, name: 'Reality' },
              { id: 10765, name: 'Sci-Fi & Fantasy' },
              { id: 10766, name: 'Soap' },
              { id: 10767, name: 'Talk' },
              { id: 10768, name: 'War & Politics' },
              { id: 37, name: 'Western' },
            ];
            break;
          case 'anime':
            genresData = [
              { id: '1', name: 'Action' },
              { id: '2', name: 'Adventure' },
              { id: '3', name: 'Comedy' },
              { id: '4', name: 'Drama' },
              { id: '5', name: 'Fantasy' },
              { id: '6', name: 'Horror' },
              { id: '7', name: 'Mystery' },
              { id: '8', name: 'Romance' },
              { id: '9', name: 'Sci-Fi' },
              { id: '10', name: 'Thriller' },
              { id: '11', name: 'Sports' },
              { id: '12', name: 'Slice of Life' },
              { id: '13', name: 'Supernatural' },
            ];
            break;
          default:
            break;
        }

        setGenres(genresData);
        if (activeTab !== 'anime') {
          setSelectedGenre(genresData.length > 0 ? genresData[0].id : '');
        } else {
          setSelectedGenre(genresData.length > 0 ? genresData[0].name : '');
        }
      };

      loadGenres();
    }
  }, [activeTab, setGenres, setSelectedGenre]);

  const toggleSearchBar = () => {
    document.getElementById('homePage').scrollIntoView({ behavior: 'smooth' });
  };

  const renderContent = () => {
    if (isLoading) {
      return <LoadingIndicator />;
    }

    if (activeTab === 'home') {
      return (
        <>
          <Banner contentType='movies' />{' '}
          {/* Banner displaying movies on the homepage */}
          <VideoCardGrid title='Recently Watched' customItems={watchedItems} />
          <VideoCardGrid
            contentType='movies'
            isHomePage
            title={'Latest Movies'}
          />
          <VideoCardGrid
            contentType='shows'
            isHomePage
            title={'Airing Now Shows'}
          />
          <VideoCardGrid
            contentType='anime'
            isHomePage
            title={'Trending Anime'}
          />
        </>
      );
    } else {
      return (
        <>
          <Banner contentType={activeTab} />
          <VideoCardGrid
            contentType={activeTab}
            genres={genres}
            selectedGenre={selectedGenre}
            setSelectedGenre={setSelectedGenre}
          />
          <VideoCardGrid
            contentType={activeTab}
            isHomePage
            title={`Trending ${activeTab}`}
          />
        </>
      );
    }
  };
  return (
    <div id={'homePage'}>
      <Header
        onSearchClick={() => {
          setIsSearchVisible(!isSearchVisible);
          toggleSearchBar();
        }}
      />
      <StarryBackground />
      <div className='home-page' translate={'yes'}>
        {isSearchVisible && <SearchBar activeTab={activeTab} />}
        <div className='home_content'>{renderContent()}</div>
        <Footer />
      </div>
    </div>
  );
};

export default HomePage;
