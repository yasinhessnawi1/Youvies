# Youvies
let genresData = [];
switch (activeTab) {
case 'movies':
genresData = [
{
"id": 28,
"name": "Action"
},
{
"id": 12,
"name": "Adventure"
},
{
"id": 16,
"name": "Animation"
},
{
"id": 35,
"name": "Comedy"
},
{
"id": 80,
"name": "Crime"
},
{
"id": 99,
"name": "Documentary"
},
{
"id": 18,
"name": "Drama"
},
{
"id": 10751,
"name": "Family"
},
{
"id": 14,
"name": "Fantasy"
},
{
"id": 36,
"name": "History"
},
{
"id": 27,
"name": "Horror"
},
{
"id": 10402,
"name": "Music"
},
{
"id": 9648,
"name": "Mystery"
},
{
"id": 10749,
"name": "Romance"
},
{
"id": 878,
"name": "Science Fiction"
},
{
"id": 10770,
"name": "TV Movie"
},
{
"id": 53,
"name": "Thriller"
},
{
"id": 10752,
"name": "War"
},
{
"id": 37,
"name": "Western"
}
]

                        break;

                    case 'shows':
                        genresData =  [
                            {
                                "id": 10759,
                                "name": "Action & Adventure"
                            },
                            {
                                "id": 16,
                                "name": "Animation"
                            },
                            {
                                "id": 35,
                                "name": "Comedy"
                            },
                            {
                                "id": 80,
                                "name": "Crime"
                            },
                            {
                                "id": 99,
                                "name": "Documentary"
                            },
                            {
                                "id": 18,
                                "name": "Drama"
                            },
                            {
                                "id": 10751,
                                "name": "Family"
                            },
                            {
                                "id": 10762,
                                "name": "Kids"
                            },
                            {
                                "id": 9648,
                                "name": "Mystery"
                            },
                            {
                                "id": 10763,
                                "name": "News"
                            },
                            {
                                "id": 10764,
                                "name": "Reality"
                            },
                            {
                                "id": 10765,
                                "name": "Sci-Fi & Fantasy"
                            },
                            {
                                "id": 10766,
                                "name": "Soap"
                            },
                            {
                                "id": 10767,
                                "name": "Talk"
                            },
                            {
                                "id": 10768,
                                "name": "War & Politics"
                            },
                            {
                                "id": 37,
                                "name": "Western"
                            }
                        ]
                        break;
                    case 'anime':
                        genresData = await fetchAnimeGenres();
                        break;
                        case 'home':
                            genresData = [
                             {

                                "id": 28,
                                "name": "Movies"
                            },
                            {
                                "id": 34512,
                                "name": "Shows"
                            },
                            {
                                    "id": 3453416,
                                    "name": "Anime"
                            },
                                {
                                "id": 763735,
                                "name": "Anime movies"

                            }];
                          break;
                    default:
                        genresData = null;
                        break;
                }

http://image.tmdb.org/t/p/w500/yb8DaYqOfUff9N9ENhuhSzUtDGQ.jpg for images from movies and series

