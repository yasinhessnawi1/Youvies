import { handleAnimeApiErrors } from './apiHelpers';
const { META } = require('@consumet/extensions');
const anilist = new META.Anilist();

// Fetch popular anime movies

// Fetch trending anime shows
export const fetchAnime = async (page, pageSize) => {
  const response = await anilist.fetchTrendingAnime(page, pageSize);
  return handleAnimeApiErrors(response.results); // Return the processed response
};

// Search for anime shows by title
export const searchAnime = async (title) => {
  console.log('searchAnime:', title);
  const response = await anilist.search(title);
  return handleAnimeApiErrors(response.results); // Return the processed response
};

// Fetch anime by genre
export const fetchAnimeByGenre = async (genre, page, pageSize) => {
  const response = await anilist.fetchAnimeGenres([genre], page, pageSize);
  return handleAnimeApiErrors(response.results); // Return the processed response
};

// Fetch detailed information about one anime
export const fetchOneAnime = async (id) => {
  const response = await anilist.fetchAnimeInfo(id);
  return handleAnimeApiErrors(response); // Return the processed response
};
