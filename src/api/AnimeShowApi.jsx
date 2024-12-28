import axios from "axios";
import { handleAnimeApiErrors } from "./apiHelpers";

const BASE_URL = "https://api.anime.youvies.online/meta/anilist";

import { META } from "@consumet/extensions"

const anilist = new  META.Anilist();

console.log(await anilist.fetchAnilistInfoById ('21'));

// Fetch trending anime shows
export const fetchAnime = async (page = 1, perPage = 20) => {
  try {
    const response = await axios.get(`${BASE_URL}/trending`, {
      params: { page, perPage },
    });
    return handleAnimeApiErrors(response.data.results); // Return the processed response
  } catch (error) {
    console.error("Error fetching trending anime:", error.message);
    throw new Error(error.message);
  }
};

// Search for anime shows by title
export const searchAnime = async (title) => {
  console.log("searchAnime:", title);
  try {
    const response = await axios.get(`${BASE_URL}/search`, {
      params: { query: title },
    });
    return handleAnimeApiErrors(response.data.results); // Return the processed response
  } catch (error) {
    console.error("Error searching anime:", error.message);
    throw new Error(error.message);
  }
};

// Fetch anime by genre
export const fetchAnimeByGenre = async (genre, page = 1, perPage = 20) => {
  try {
    const response = await axios.get(`${BASE_URL}/genres`, {
      params: { genres: genre, page, perPage },
    });
    return handleAnimeApiErrors(response.data.results); // Return the processed response
  } catch (error) {
    console.error("Error fetching anime by genre:", error.message);
    throw new Error(error.message);
  }
};

// Fetch detailed information about one anime
export const fetchOneAnime = async (id) => {
  try {
    const response = await axios.get(`${BASE_URL}/info/${id}`);
    return handleAnimeApiErrors(response.data); // Return the processed response
  } catch (error) {
    console.error("Error fetching anime details:", error.message);
    throw new Error(error.message);
  }
};
