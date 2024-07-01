export interface Torrent {
    // Define the properties of Torrent
}

export interface Anime {
    id: string;
    type: string;
    attributes: {
        createdAt: string;
        updatedAt: string;
        slug: string;
        synopsis: string;
        description: string;
        coverImageTopOffset: number;
        titles: {
            en?: string;
            en_jp: string;
            ja_jp: string;
            en_us?: string;
        };
        canonicalTitle: string;
        abbreviatedTitles: string[];
        averageRating: string;
        ratingFrequencies: {
            [key: string]: string;
        };
        userCount: number;
        favoritesCount: number;
        startDate: string;
        endDate: string;
        nextRelease: any;
        popularityRank: number;
        ratingRank: number;
        ageRating: string;
        ageRatingGuide: string;
        subtype: string;
        status: string;
        tba?: string;
        posterImage: {
            tiny: string;
            large: string;
            small: string;
            medium: string;
            original: string;
        };
        coverImage?: {
            tiny: string;
            large: string;
            small: string;
            original: string;
        };
        episodeCount: number;
        episodeLength?: number;
        totalLength: number;
        youtubeVideoId: string;
        showType: string;
        nsfw: boolean;
    };
    relationships: {
        genres: {
            links: {
                self: string;
                related: string;
            };
        };
        // Define other relationships if needed
    };
}

export interface Movie {
    id: string;
    title: string;
    description: string;
    year: string;
    director: string;
    genres: string;
    torrents: Torrent[];
    rating: string;
    poster_url: string;
    language: string;
}

export interface Show {
    id: string;
    title: string;
    description: string;
    year: number;
    rating: number;
    image_url: string;
    language: string;
    networks: string[];
    first_air_date: string;
    episodes: Torrent[];
    country: string[];
    backdrop: string;
}
