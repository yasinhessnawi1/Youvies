interface Movie {
  id: number;
  title: string;
  director: string;
  releaseDate: string;
  genre: string;
  rating: number;
}

interface TinyMovie {
  id: number;
  title: string;
}

interface Anime {
  id: number;
  title: string;
  episodes: number;
  studio: string;
  releaseDate: string;
  genre: string;
  rating: number;
}

interface TinyAnime {
  id: number;
  title: string;
}

interface Show {
  id: number;
  title: string;
  seasons: number;
  network: string;
  releaseDate: string;
  genre: string;
  rating: number;
}

interface TinyShow {
  id: number;
  title: string;
}
