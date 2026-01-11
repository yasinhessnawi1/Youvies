import React, { useEffect, useRef, useState } from 'react';
import '../styles/page/HomePage.css';
import Header from '../components/static/Header';
import Banner from '../components/Banner';
import VideoCardGrid from '../components/Carousel';
import Footer from '../components/static/Footer';
import StarryBackground from '../components/static/StarryBackground';
import SearchBar from '../components/SearchBar';
import { TabContext } from '../contexts/TabContext';
import { useItemContext } from '../contexts/ItemContext';

const HomePage = () => {
  const { activeTab } = React.useContext(TabContext);
  const [isSearchVisible, setIsSearchVisible] = useState(false); // New state to manage search bar visibility

  const {
    items,
    genres,
    selectedGenre,
    setSelectedGenre,
    setGenres,
    fetchAllItems,
    watchedItems,
    fetchUserRecommendations,
  } = useItemContext();

  // State for recommendation carousels
  const [movieRecommendations, setMovieRecommendations] = useState([]);
  const [showRecommendations, setShowRecommendations] = useState([]);
  const [animeRecommendations, setAnimeRecommendations] = useState([]);

  // Helper to check if user has watched items of a specific type
  const hasWatchedType = (mediaType) => {
    const allWatched = watchedItems || [];
    return allWatched.some((item) => {
      const itemType = item.type || item.content_type;
      return itemType === mediaType;
    });
  };

  // Helper to get watched items filtered by type
  const getWatchedByType = (mediaType) => {
    const allWatched = watchedItems || [];
    return allWatched.filter((item) => {
      const itemType = item.type || item.content_type;
      return itemType === mediaType;
    });
  };

  // Memoized filtered watched items for each type
  const watchedMovies = getWatchedByType('movies');
  const watchedShows = getWatchedByType('shows');
  const watchedAnime = getWatchedByType('anime');

  // Fetch recommendations when component mounts or watched items change
  useEffect(() => {
    const loadRecommendations = async () => {
      if (hasWatchedType('movies')) {
        const recs = await fetchUserRecommendations('movies');
        setMovieRecommendations(recs);
      }
      if (hasWatchedType('shows')) {
        const recs = await fetchUserRecommendations('shows');
        setShowRecommendations(recs);
      }
      if (hasWatchedType('anime')) {
        const recs = await fetchUserRecommendations('anime');
        setAnimeRecommendations(recs);
      }
    };
    loadRecommendations();
  }, [watchedItems, fetchUserRecommendations]);

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
              { id: 'Action', name: 'Action' },
              { id: 'Adventure', name: 'Adventure' },
              { id: 'Comedy', name: 'Comedy' },
              { id: 'Drama', name: 'Drama' },
              { id: 'Fantasy', name: 'Fantasy' },
              { id: 'Horror', name: 'Horror' },
              { id: 'Mecha', name: 'Mecha' },
              { id: 'Music', name: 'Music' },
              { id: 'Mystery', name: 'Mystery' },
              { id: 'Psychological', name: 'Psychological' },
              { id: 'Romance', name: 'Romance' },
              { id: 'Sci-Fi', name: 'Sci-Fi' },
              { id: 'Slice of Life', name: 'Slice of Life' },
              { id: 'Sports', name: 'Sports' },
              { id: 'Supernatural', name: 'Supernatural' },
              { id: 'Thriller', name: 'Thriller' },
            ];
            break;
          default:
            genresData = [{28 : 'Action'}]
        }

        setGenres(genresData);
        setSelectedGenre(genresData.length > 0 ? genresData[0].id : 'Unknown');
      };
      loadGenres();
    }
  }, [activeTab, setGenres, setSelectedGenre]);

  const toggleSearchBar = () => {
    document.getElementById('homePage').scrollIntoView({ behavior: 'smooth' });
  };

  const renderContent = () => {
    if (activeTab === 'home') {
      return (
        <>
          <Banner contentType="movies" />
          {/* Continue Watching / Recently Watched */}
          {watchedItems?.length > 0 && (
            <VideoCardGrid
              title="Continue Watching"
              customItems={watchedItems}
            />
          )}
          {/* Recommended For You - aggregated from all watched */}
          {(movieRecommendations.length > 0 ||
            showRecommendations.length > 0 ||
            animeRecommendations.length > 0) && (
            <VideoCardGrid
              title="Recommended For You"
              customItems={[
                ...movieRecommendations,
                ...showRecommendations,
                ...animeRecommendations,
              ].slice(0, 20)}
            />
          )}
          {/* Movies Carousels */}
          <VideoCardGrid
            contentType="movies"
            listType="trending"
            title="Trending Movies"
            extraParams={{ timeWindow: 'week' }}
          />
          <VideoCardGrid
            contentType="movies"
            listType="top_rated"
            title="Top Rated Movies"
          />
          {/* TV Shows Carousels */}
          <VideoCardGrid
            contentType="shows"
            listType="popular"
            title="Popular TV Shows"
          />
          <VideoCardGrid
            contentType="shows"
            listType="airing_today"
            title="Airing Today"
          />
          {/* Anime Carousels */}
          <VideoCardGrid
            contentType="anime"
            listType="trending"
            title="Trending Anime"
          />
          <VideoCardGrid
            contentType="anime"
            listType="popular"
            title="Popular Anime"
          />
        </>
      );
    } else if (activeTab === 'movies') {
      return (
        <>
          <Banner contentType="movies" />
          {/* Continue Watching Movies - only show if user has watched movies */}
          {watchedMovies.length > 0 && (
            <VideoCardGrid
              title="Continue Watching"
              customItems={watchedMovies}
            />
          )}
          {/* Movie Recommendations - only show if user has watched movies */}
          {hasWatchedType('movies') && movieRecommendations.length > 0 && (
            <VideoCardGrid
              title="Recommended For You"
              customItems={movieRecommendations}
            />
          )}
          <VideoCardGrid
            contentType="movies"
            listType="trending"
            title="Trending Movies"
            extraParams={{ timeWindow: 'day' }}
          />
          <VideoCardGrid
            contentType="movies"
            listType="now_playing"
            title="Now Playing"
          />
          <VideoCardGrid
            contentType="movies"
            listType="top_rated"
            title="Top Rated Movies"
          />
          <VideoCardGrid
            contentType="movies"
            listType="upcoming"
            title="Upcoming Movies"
          />
          {/* Genre Selector Carousel - existing */}
          <VideoCardGrid
            contentType="movies"
            genres={genres}
            selectedGenre={selectedGenre}
            setSelectedGenre={setSelectedGenre}
          />
        </>
      );
    } else if (activeTab === 'shows') {
      return (
        <>
          <Banner contentType="shows" />
          {/* Continue Watching Shows - only show if user has watched shows */}
          {watchedShows.length > 0 && (
            <VideoCardGrid
              title="Continue Watching"
              customItems={watchedShows}
            />
          )}
          {/* Show Recommendations - only show if user has watched shows */}
          {hasWatchedType('shows') && showRecommendations.length > 0 && (
            <VideoCardGrid
              title="Recommended For You"
              customItems={showRecommendations}
            />
          )}
          <VideoCardGrid
            contentType="shows"
            listType="trending"
            title="Trending Shows"
            extraParams={{ timeWindow: 'day' }}
          />
          <VideoCardGrid
            contentType="shows"
            listType="airing_today"
            title="Airing Today"
          />
          <VideoCardGrid
            contentType="shows"
            listType="on_the_air"
            title="On The Air"
          />
          <VideoCardGrid
            contentType="shows"
            listType="top_rated"
            title="Top Rated Shows"
          />
          {/* Genre Selector Carousel - existing */}
          <VideoCardGrid
            contentType="shows"
            genres={genres}
            selectedGenre={selectedGenre}
            setSelectedGenre={setSelectedGenre}
          />
        </>
      );
    } else if (activeTab === 'anime') {
      return (
        <>
          <Banner contentType="anime" />
          {/* Continue Watching Anime - only show if user has watched anime */}
          {watchedAnime.length > 0 && (
            <VideoCardGrid
              title="Continue Watching"
              customItems={watchedAnime}
            />
          )}
          {/* Anime Recommendations - only show if user has watched anime */}
          {hasWatchedType('anime') && animeRecommendations.length > 0 && (
            <VideoCardGrid
              title="Recommended For You"
              customItems={animeRecommendations}
            />
          )}
          <VideoCardGrid
            contentType="anime"
            listType="airing_schedule"
            title="Airing Today"
          />
          <VideoCardGrid
            contentType="anime"
            listType="trending"
            title="Trending Anime"
          />
          <VideoCardGrid
            contentType="anime"
            listType="popular"
            title="Popular Anime"
          />
          <VideoCardGrid
            contentType="anime"
            listType="new_episodes"
            title="New Episodes"
          />
          <VideoCardGrid
            contentType="anime"
            listType="top_rated_anime"
            title="Anime Movies"
          />
          <VideoCardGrid
            contentType="anime"
            listType="seasonal"
            title="This Year's Anime"
          />
          {/* Genre Selector Carousel - existing */}
          <VideoCardGrid
            contentType="anime"
            genres={genres}
            selectedGenre={selectedGenre}
            setSelectedGenre={setSelectedGenre}
          />
        </>
      );
    }
    return null;
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
      <div className="home-page" translate={'yes'}>
        {isSearchVisible && <SearchBar activeTab={activeTab} />}
        <div className="home_content">{renderContent()}</div>
        <Footer />
      </div>
    </div>
  );
};

export default HomePage;
