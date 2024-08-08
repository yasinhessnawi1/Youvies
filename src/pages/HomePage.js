// src/pages/HomePage.js

import React, { useContext, useEffect, useState } from 'react';
import '../styles/HomePage.css';
import Header from "../components/Header";
import Banner from "../components/Banner";
import VideoCardGrid from "../components/VideoCardGrid";
import Footer from "../components/Footer";
import StarryBackground from "../components/StarryBackground";
import LoadingIndicator from "../components/LoadingIndicator";
import { ItemContext } from "../contexts/ItemContext";
import { TabContext } from "../contexts/TabContext";
import { useLoading } from "../contexts/LoadingContext";
import SearchBar from '../components/SearchBar';

const HomePage = () => {
    const { items, fetchItemsByGenre } = useContext(ItemContext);
    const { activeTab } = useContext(TabContext);
    const { isLoading } = useLoading();
    const [genres, setGenres] = useState([]);
    const [genreItems, setGenreItems] = useState({});

    useEffect(() => {
        const loadGenres = () => {
            let genresData = [];
            switch (activeTab) {
                case 'movies':
                    genresData = [
                        { "id": 28, "name": "Action" },
                        { "id": 12, "name": "Adventure" },
                        { "id": 16, "name": "Animation" },
                        { "id": 35, "name": "Comedy" },
                        { "id": 80, "name": "Crime" },
                        { "id": 99, "name": "Documentary" },
                        { "id": 18, "name": "Drama" },
                        { "id": 10751, "name": "Family" },
                        { "id": 14, "name": "Fantasy" },
                        { "id": 36, "name": "History" },
                        { "id": 27, "name": "Horror" },
                        { "id": 10402, "name": "Music" },
                        { "id": 9648, "name": "Mystery" },
                        { "id": 10749, "name": "Romance" },
                        { "id": 878, "name": "Science Fiction" },
                        { "id": 10770, "name": "TV Movie" },
                        { "id": 53, "name": "Thriller" },
                        { "id": 10752, "name": "War" },
                        { "id": 37, "name": "Western" }
                    ];
                    break;
                case 'shows':
                    genresData = [
                        { "id": 10759, "name": "Action & Adventure" },
                        { "id": 16, "name": "Animation" },
                        { "id": 35, "name": "Comedy" },
                        { "id": 80, "name": "Crime" },
                        { "id": 99, "name": "Documentary" },
                        { "id": 18, "name": "Drama" },
                        { "id": 10751, "name": "Family" },
                        { "id": 10762, "name": "Kids" },
                        { "id": 9648, "name": "Mystery" },
                        { "id": 10763, "name": "News" },
                        { "id": 10764, "name": "Reality" },
                        { "id": 10765, "name": "Sci-Fi & Fantasy" },
                        { "id": 10766, "name": "Soap" },
                        { "id": 10767, "name": "Talk" },
                        { "id": 10768, "name": "War & Politics" },
                        { "id": 37, "name": "Western" }
                    ];
                    break;
                case 'anime':
                    genresData = [
                        { "id": "1", "name": "Action" },
                        { "id": "2", "name": "Adventure" },
                        { "id": "3", "name": "Comedy" },
                        { "id": "4", "name": "Drama" },
                        { "id": "5", "name": "Fantasy" },
                        { "id": "6", "name": "Horror" },
                        { "id": "7", "name": "Mystery" },
                        { "id": "8", "name": "Romance" },
                        { "id": "9", "name": "Sci-Fi" },
                        { "id": "10", "name": "Thriller" },
                        { "id": "11", "name": "Sports" },
                        { "id": "12", "name": "Slice of Life" },
                        { "id": "13", "name": "Supernatural" }
                    ];
                    break;
                default:
                    break;
            }
            setGenres(genresData);
        };

        loadGenres();
    }, [activeTab]);

    useEffect(() => {
        const loadGenreItems = async () => {
            let itemsByGenre = {};

            // Fetch 10 items for each genre first
            await Promise.all(genres.map(async (genre) => {
                itemsByGenre[genre.name] = await fetchItemsByGenre(activeTab, genre.name, 1, 5);
            }));
            setGenreItems(itemsByGenre);

            // Then fetch 100 items for each genre in the background
            await Promise.all(genres.map(async (genre) => {
                const fetchedItems = await fetchItemsByGenre(activeTab, genre.name, 1, 50);
                setGenreItems(prevItems => ({
                    ...prevItems,
                    [genre.name]: fetchedItems,
                }));
            }));
        };

        if (genres.length) {
            loadGenreItems();
        }
    }, [genres, activeTab, fetchItemsByGenre]);

    const renderContent = () => {
        if (activeTab === 'home') {
            return (
                <>
                    <h2>Movies</h2>
                    <VideoCardGrid contentType="movies" items={items.movies} genre={'Movies'} />
                    <h2>TV Shows</h2>
                    <VideoCardGrid contentType="shows" items={items.shows} genre={'Shows'} />
                    <h2>Anime Movies</h2>
                    <VideoCardGrid contentType="anime_movies" items={items.animeMovies} genre={'Anime Movies'} />
                    <h2>Anime Shows</h2>
                    <VideoCardGrid contentType="anime_shows" items={items.animeShows} genre={'Anime Shows'} />
                </>
            );
        }

        return genres.map((genre) => (
            <div key={genre.id}>
                <h2>{genre.name}</h2>
                <VideoCardGrid contentType={activeTab} items={genreItems[genre.name] || []} genre={genre.name} />
            </div>
        ));
    };

    return (
        <>
            <Header />
            <StarryBackground />
            <div className="home-page">
                <SearchBar activeTab={activeTab} />
                {isLoading && <LoadingIndicator />}
                <Banner contentType={activeTab} />
                <div className="home_content">
                    {renderContent()}
                </div>
                <Footer />
            </div>
        </>
    );
};

export default HomePage;
