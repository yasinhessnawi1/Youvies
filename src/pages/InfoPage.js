import React, {useContext, useEffect, useRef, useState} from 'react';
import '../styles/page/InfoPage.css';
import Header from "../components/static/Header";
import Footer from "../components/static/Footer";
import {useItemContext} from '../contexts/ItemContext';
import {useParams} from 'react-router-dom';
import StarryBackground from "../components/static/StarryBackground";
import LoadingIndicator from "../components/static/LoadingIndicator";
import {VideoPlayerContext} from "../contexts/VideoPlayerContext";
import {useLoading} from "../contexts/LoadingContext";
import {UserContext} from "../contexts/UserContext";
import VideoCardGrid from "../components/VideoCardGrid";
import CountdownTimer from "../utils/CountdownTimer";
import Button from "../components/Button";

const InfoPage = () => {
    const {isLoading, setIsLoading} = useLoading();
    const [error, setError] = useState('');
    const {videoPlayerState, switchProvider} = useContext(VideoPlayerContext);
    const {mediaId, category} = useParams();
    const {fetchMediaInfo, itemsCache} = useItemContext();
    const [selectedSeason, setSelectedSeason] = useState(null);
    const [selectedEpisode, setSelectedEpisode] = useState(null);
    const {user} = useContext(UserContext);
    const [itemInfo, setItemInfo] = useState(null);
    const [isSearchVisible, setIsSearchVisible] = useState(false);
    const {addToWatchedList, getWatchedItem} = useContext(UserContext);

    // Ref for the episodes grid container
    const sideContentRef = useRef(null);

    const getTitle = (item) => {
        let title = '';
        switch (item.type) {
            case 'movies':
                title = item.title || '';
                break;
            case 'shows':
                title = item.name || '';
                break;
            case 'anime':
                title = item.title.userPreferred || item.title.romaji || item.title.english || item.title.native || '';
                break;
        }
        return title;
    }

    useEffect(() => {
        const loadMediaInfo = async () => {
            if (!mediaId || !category || isLoading) return;

            const cacheKey = `${category}-${mediaId}`;

            // Check if the item is already in the cache
            if (itemsCache[cacheKey]) {
                setItemInfo(itemsCache[cacheKey]);
                initializeSelectedSeasonAndEpisode(itemsCache[cacheKey]);
                return; // Use the cached item
            }

            setIsLoading(true);
            try {
                const fetchedItem = await fetchMediaInfo(mediaId, category);
                setItemInfo(fetchedItem);
                initializeSelectedSeasonAndEpisode(fetchedItem);
            } catch (err) {
                setError('Failed to load media information.');
            } finally {
                setIsLoading(false);
            }
        };

        const initializeSelectedSeasonAndEpisode = (item) => {
            if (!item || item.type === 'movies') return;
            const title = getTitle(item) || '';
            const watchedItem = getWatchedItem(item.type, title);
            let initialSeason = null;
            let initialEpisode = {episode_number: 1};
            if (item.type === 'anime') {
                initialSeason = {season_number: item.season || 1, episode_count: item.totalEpisodes};
                if (watchedItem) {
                    const [, , season, episode] = watchedItem.split(':');
                    initialSeason = {season_number: parseInt(season, 10) || 1, episode_count: item.totalEpisodes};
                    initialEpisode = {episode_number: parseInt(episode, 10)};
                }
            } else {
                initialSeason = item.seasons[0];
                if (watchedItem) {
                    const [, , season, episode] = watchedItem.split(':');
                    initialSeason = item.seasons.find(s => s.season_number === parseInt(season, 10)) || initialSeason;
                    initialEpisode = {episode_number: parseInt(episode, 10)};
                }
            }

            setSelectedSeason(initialSeason);
            setSelectedEpisode(initialEpisode);
        };

        loadMediaInfo();
    }, [mediaId, category, fetchMediaInfo, itemsCache]);

    useEffect(() => {
        if (selectedEpisode && sideContentRef.current) {
            const episodeIndex = selectedEpisode.episode_number - 1;
            const episodeElement = sideContentRef.current.querySelector(`.episode-bubble:nth-child(${episodeIndex + 1})`);

            if (episodeElement) {
                const container = sideContentRef.current;
                const containerHeight = container.clientHeight;
                const elementOffsetTop = episodeElement.offsetTop;
                const elementHeight = episodeElement.clientHeight;

                // Calculate the scroll position to center the selected episode
                // Set the scrollTop of the container
                container.scrollTop = elementOffsetTop - containerHeight / 2 + elementHeight / 2;
            }
        }
    }, [selectedEpisode]);


    const handleSeasonChange = async (season) => {
        setSelectedSeason(season);
        setSelectedEpisode({episode_number: 1});
    };

    const handleEpisodeChange = (episode) => {
        setSelectedEpisode(episode);
        addToWatchedList(`${itemInfo.type}:${itemInfo.title || itemInfo.name}:${selectedSeason.season_number}:${episode.episode_number}`);
    };


    const constructVideoUrl = (provider, season = 1, episode = 1) => {
        const id = itemInfo?.id;
        if (!id) return '';

        switch (provider) {
            case 'NontonGo':
                return itemInfo.type === 'shows'
                    ? `https://NontonGo.win/embed/tv/${id}/${season}/${episode}`
                    : `https://NontonGo.win/embed/movie/${id}`;
            case 'SuperEmbed':
                return itemInfo.type === 'shows'
                    ? `https://multiembed.mov/directstream.php?video_id=${id}&tmdb=1&s=${season}&e=${episode}`
                    : `https://multiembed.mov/directstream.php?video_id=${id}&tmdb=1`;
            case '2embed':
                if (itemInfo.type === 'shows') {
                    return `https://www.2embed.cc/embedtv/${id}&s=${season}&e=${episode}`;
                } else if (itemInfo.type === 'anime') {
                    let title = itemInfo.title.userPreferred || itemInfo.title.romaji || itemInfo.title.english || itemInfo.title.native || 'Unknown Title';
                    title = title.replace(/ /g, '-').toLowerCase();
                    return `https://2anime.xyz/embed/${title}-episode-${episode}`;
                } else {
                    return `https://www.2embed.cc/embed/${id}`;
                }
            default:
                return '';
        }
    };

    if (isLoading) {
        return <LoadingIndicator/>;
    }

    if (error) {
        return <div className="error-message">{error}</div>;
    }

    if (!itemInfo) {
        return null; // or a loading state
    }

    const videoSrc = constructVideoUrl(videoPlayerState.provider, selectedSeason?.season_number, selectedEpisode?.episode_number);
    const imageUrl = itemInfo.backdrop_path
        ? `https://image.tmdb.org/t/p/original${itemInfo.backdrop_path}`
        : itemInfo.cover ? itemInfo.cover : itemInfo.poster_path
            ? `https://image.tmdb.org/t/p/original${itemInfo.poster_path}`
            : 'https://via.placeholder.com/300x450?text=Loading...';
    const title = itemInfo.type === 'anime' ? itemInfo.title.userPreferred : itemInfo.title || itemInfo.name || 'Title loading...';

    const renderSubInfo = () => {
        switch (itemInfo.type) {
            case 'anime':
                return (
                    <div className="sub-info-container">
                        <div className="sub-info-item">
                            <strong>Type:</strong> {itemInfo.type}
                        </div>
                        <div className="sub-info-item">
                            <strong>Genres:</strong> {itemInfo.genres.join(', ')}
                        </div>
                        <div className="sub-info-item">
                            <strong>Studios:</strong> {itemInfo.studios.join(', ')}
                        </div>
                        <div className="sub-info-item">
                            <strong>Country of Origin:</strong> {itemInfo.countryOfOrigin}
                        </div>
                        <div className="sub-info-item">
                            <strong>Release Date:</strong> {itemInfo.startDate.year}
                        </div>
                        <div className="sub-info-item">
                            <strong>Status:</strong> {itemInfo.status}
                        </div>
                        <div className="sub-info-item">
                            <strong>Rating:</strong> {(itemInfo.rating / 10).toFixed(1)}
                        </div>
                        <div className="sub-info-item">
                            <strong>Duration:</strong> {itemInfo.duration} min
                        </div>
                        <div className="sub-info-item">
                            <strong>Episodes:</strong> {itemInfo.currentEpisode}/{itemInfo.totalEpisodes}
                        </div>
                        <div className="sub-info-item">
                            <strong>Popularity:</strong> {itemInfo.popularity}
                        </div>
                        <div className="sub-info-item">
                            <strong>Synonyms:</strong> {itemInfo.synonyms.join(', ')}
                        </div>
                        <div className="sub-info-item">
                            <strong>Description:</strong> {itemInfo.description}
                        </div>
                        {itemInfo.characters && (
                            <div className="sub-info-item">
                                <strong>Characters:</strong> {itemInfo.characters.map(char => char.name.full).join(', ')}
                            </div>
                        )}
                    </div>
                );
            case 'movies':
                return (
                    <div className="sub-info-container">
                        <div className="sub-info-item">
                            <strong>Original Title:</strong> {itemInfo.original_title}
                        </div>
                        <div className="sub-info-item">
                            <strong>Genres:</strong> {itemInfo.genres.map(genre => genre.name).join(', ')}
                        </div>
                        <div className="sub-info-item">
                            <strong>Runtime:</strong> {itemInfo.runtime} min
                        </div>
                        <div className="sub-info-item">
                            <strong>Release Date:</strong> {itemInfo.release_date}
                        </div>
                        <div className="sub-info-item">
                            <strong>Country:</strong> {itemInfo.production_countries.map(country => country.name).join(', ')}
                        </div>
                        <div className="sub-info-item">
                            <strong>Budget:</strong> {itemInfo.budget > 0 ? `$${itemInfo.budget.toLocaleString()}` : 'N/A'}
                        </div>
                        <div className="sub-info-item">
                            <strong>Revenue:</strong> {itemInfo.revenue > 0 ? `$${itemInfo.revenue.toLocaleString()}` : 'N/A'}
                        </div>
                        <div className="sub-info-item">
                            <strong>Production Companies:</strong> {itemInfo.production_companies.map(company => company.name).join(', ')}
                        </div>
                        <div className="sub-info-item">
                            <strong>Status:</strong> {itemInfo.status}
                        </div>
                        <div className="sub-info-item">
                            <strong>Tagline:</strong> {itemInfo.tagline}
                        </div>
                        <div className="sub-info-item">
                            <strong>Overview:</strong> {itemInfo.overview}
                        </div>
                    </div>
                );
            case 'shows':
                return (
                    <div className="sub-info-container">
                        <div className="sub-info-item">
                            <strong>Original Name:</strong> {itemInfo.original_name}
                        </div>
                        <div className="sub-info-item">
                            <strong>Genres:</strong> {itemInfo.genres.map(genre => genre.name).join(', ')}
                        </div>
                        <div className="sub-info-item">
                            <strong>First Air Date:</strong> {itemInfo.first_air_date}
                        </div>
                        <div className="sub-info-item">
                            <strong>Number of Seasons:</strong> {itemInfo.number_of_seasons}
                        </div>
                        <div className="sub-info-item">
                            <strong>Number of Episodes:</strong> {itemInfo.number_of_episodes}
                        </div>
                        <div className="sub-info-item">
                            <strong>Runtime per Episode:</strong> {itemInfo.episode_run_time[0]} min
                        </div>
                        <div className="sub-info-item">
                            <strong>Networks:</strong> {itemInfo.networks.map(network => network.name).join(', ')}
                        </div>
                        <div className="sub-info-item">
                            <strong>Languages:</strong> {itemInfo.languages.join(', ')}
                        </div>
                        <div className="sub-info-item">
                            <strong>Status:</strong> {itemInfo.status}
                        </div>
                        <div className="sub-info-item">
                            <strong>Tagline:</strong> {itemInfo.tagline}
                        </div>
                        {itemInfo.last_episode_to_air && (
                            <div className="sub-info-item">
                                <strong>Last Episode Aired:</strong> {itemInfo.last_episode_to_air.name} (Episode {itemInfo.last_episode_to_air.episode_number})
                            </div>
                        )}
                        {itemInfo.next_episode_to_air && (
                            <div className="sub-info-item">
                                <strong>Next Episode:</strong> {itemInfo.next_episode_to_air.air_date}
                                <CountdownTimer targetDate={itemInfo.next_episode_to_air.airDate} />
                            </div>
                        )}
                        <div className="sub-info-item">
                            <strong>Overview:</strong> {itemInfo.overview}
                        </div>
                    </div>
                );
            default:
                return null;
        }
    };


    return (
        <>
            <StarryBackground/>
            <Header onSearchClick={() => setIsSearchVisible(!isSearchVisible)}/>
            <div className="info-page">
                <div className="info-card" style={{backgroundImage: `url(${imageUrl})`}}>
                    <div className="overlay">
                        <h1 className="info-card-title">{title}</h1>
                        <div className="sub-info">
                            {renderSubInfo()}
                        </div>
                    </div>
                </div>

                <div className="content">
                    <div className="main-content">
                        <div className="video-player">
                            <iframe
                                className={"video"}
                                src={videoSrc}
                                title="Video player"
                                width="100%"
                                height="100%"
                                allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                                frameBorder="0"
                                allowFullScreen
                            ></iframe>
                            {itemInfo.type !== 'anime' && <div className="player-buttons">
                                <button
                                    className={`player-button ${videoPlayerState.provider === 'SuperEmbed' ? 'active' : ''}`}
                                    onClick={() => switchProvider('SuperEmbed')}
                                >
                                    No CC
                                </button>
                                <button
                                    className={`player-button ${videoPlayerState.provider === '2embed' ? 'active' : ''}`}
                                    onClick={() => switchProvider('2embed')}
                                >
                                    English CC
                                </button>
                                <button
                                    className={`player-button ${videoPlayerState.provider === 'NontonGo' ? 'active' : ''}`}
                                    onClick={() => switchProvider('NontonGo')}
                                >
                                    Multi CC
                                </button>
                            </div>
                            }
                    </div>

                    <div className="side-content" ref={sideContentRef}>
                        {itemInfo.type === 'movies' ? (
                            <div className="related-videos">
                                <h2>Related Movies</h2>
                                <div className="related-grid">
                                    {itemInfo.relatedMovies?.map((relatedMovie) => (
                                        <div key={relatedMovie.id} className="related-card">
                                            <img
                                                src={`https://image.tmdb.org/t/p/original${relatedMovie.poster_path}`}
                                                alt={relatedMovie.title}/>
                                            <p>{relatedMovie.title}</p>
                                                <Button text="Info" category={itemInfo.type} id={relatedMovie.id} />
                                            </div>
                                        ))}
                                    </div>
                                </div>
                            ) : (
                                <div className="episodes-list">
                                    <div className="season-selector">
                                        {itemInfo.type === 'anime' ? (
                                            <div className="season-text">
                                                Season {itemInfo.season || 1}
                                            </div>
                                        ) : (
                                            <select
                                                value={selectedSeason?.season_number || 1}
                                                onChange={(e) => handleSeasonChange(itemInfo.seasons.find(season => season.season_number === parseInt(e.target.value)))}>
                                                {itemInfo.seasons?.map((season) => (
                                                    <option key={season.id} value={season.season_number}>
                                                        {season.name}
                                                    </option>
                                                ))}
                                            </select>
                                        )}
                                    </div>

                                    <div className="episodes-grid" >
                                        {Array.from({length: selectedSeason?.episode_count || itemInfo.totalEpisodes || 0}, (_, index) => (
                                            <button
                                                key={index + 1}
                                                className={`episode-bubble ${index + 1 === selectedEpisode?.episode_number ? 'active' : ''}`}
                                                onClick={() => handleEpisodeChange({episode_number: index + 1})}
                                            >
                                                {index + 1}
                                            </button>
                                        ))}
                                    </div>
                                </div>
                            )}

                        </div>

                    </div>

                </div>
                {itemInfo.recommendations && itemInfo.recommendations.length > 0 && itemInfo.type !== 'movies' &&(
                    <VideoCardGrid
                        contentType={itemInfo.type}
                        isRelated={true}
                        title="Recommended For You"
                        customItems={itemInfo.recommendations}
                    />
                )}
                <Footer/>
            </div>
        </>
    );
}
export default InfoPage;
