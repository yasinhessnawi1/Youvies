export const getTitle = (item) => {
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

export const playClick = (item, addToWatchedList, getWatchedItem, showVideoPlayer) => {
    const title = getTitle(item);
    const watchedItem = getWatchedItem(item.type, item.id, title);
    if (watchedItem !== null) {
        console.log('watchedItem:', watchedItem);
        const [, , , season, episode] = watchedItem.split(':');
        showVideoPlayer(item.id, item.type, season, episode);
    } else {
        addToWatchedList(`${item.type}:${item.id}:${title}:1:1`);
        showVideoPlayer(item.id, item.type);
    }

};