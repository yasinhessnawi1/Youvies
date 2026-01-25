import React, { useMemo } from 'react';
import {
  FaCheckCircle,
  FaRegCircle,
  FaStar,
} from 'react-icons/fa';
import { useAuth } from '../contexts/AuthContext';
import '../styles/components/ItemCard.css';
import { Link } from 'react-router-dom';

const ItemCard = React.memo(({ item }) => {
  const { watchedItems } = useAuth();

  const isWatched = useMemo(() => {
    if (!item || !watchedItems) return false;
    return watchedItems.some(watched =>
      watched.tmdb_id === parseInt(item.id) &&
      watched.content_type === item.type
    );
  }, [item, watchedItems]);


  const { title, rating, imageUrl } = useMemo(() => {
    let ratingValue = 0;
    let imagePath = '';
    let itemTitle = '';

    if (item.type === 'anime') {
      // Handle anime data from AniList API
      // title can be an object with {romaji, english, native, userPreferred}
      if (typeof item.title === 'object' && item.title !== null) {
        itemTitle = item.title.english || item.title.userPreferred || item.title.romaji || 'Title not found';
      } else {
        itemTitle = item.title || item.name || 'Title not found';
      }
      // Anime rating is 0-100, convert to 0-10
      ratingValue = item.rating ? item.rating / 10 : 0;
      imagePath = item.image || item.cover || null;
    } else if (['movies', 'shows'].includes(item.type)) {
      // Handle TMDB data
      itemTitle = item.name || item.title || 'Title not found';
      ratingValue = item.vote_average || 0;
      imagePath = item.poster_path
        ? `https://image.tmdb.org/t/p/original${item.poster_path}`
        : null;
    }

    return {
      title: itemTitle,
      rating: ratingValue,
      imageUrl: imagePath,
    };
  }, [
    item.name,
    item.vote_average,
    item.poster_path,
    item.rating,
    item.type,
    item.title,
    item.image,
    item.cover,
  ]);

  // Fallback gradient for missing images
  const fallbackStyle = {
    background: 'linear-gradient(135deg, #1a1a2e 0%, #16213e 50%, #0f3460 100%)',
  };

  return (
    <Link
      to={`/info/${item.type}/${item.id}`}
      style={{ textDecoration: 'none' }}
    >
      <div className='item-card'>
        <div
          className='item-image'
          style={imageUrl ? { backgroundImage: `url(${imageUrl})` } : fallbackStyle}
        >
          <div className='watched-icon'>
            {isWatched ? <FaCheckCircle color='green' /> : <FaRegCircle />}
          </div>
        </div>
        <div className='item-content'>
          <div className='title'>{title}</div>
          <div className='rating'>
            {[...Array(5)].map((_, index) => (
              <FaStar
                key={index}
                color={index < rating / 2 ? 'gold' : 'grey'}
              />
            ))}
          </div>
        </div>
      </div>
    </Link>
  );
});

export default ItemCard;
