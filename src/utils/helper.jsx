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
      title =
        item.title.userPreferred ||
        item.title.romaji ||
        item.title.english ||
        item.title.native ||
        '';
      break;
  }
  return title;
};