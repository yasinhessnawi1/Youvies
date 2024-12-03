import React, {
  useEffect,
  useState,
  forwardRef,
  useImperativeHandle,
  useCallback,
} from 'react';
import ItemCard from './ItemCard';
import '../styles/components/Carousel.css';
import { useItemContext } from '../contexts/ItemContext';

const Carousel = forwardRef(({ items = [], onReachEnd, isRelated }, ref) => {
  const [currentIndex, setCurrentIndex] = useState(0);
  const [itemsPerPage, setItemsPerPage] = useState(1);
  const { isLoading } = useItemContext();

  useImperativeHandle(ref, () => ({
    resetCarousel: () => setCurrentIndex(0),
  }));

  const updateItemsPerPage = useCallback(() => {
    if (window.innerWidth > 1200) {
      setItemsPerPage(5);
    } else if (window.innerWidth > 992) {
      setItemsPerPage(4);
    } else if (window.innerWidth > 768) {
      setItemsPerPage(3);
    } else if (window.innerWidth > 576) {
      setItemsPerPage(2);
    } else {
      setItemsPerPage(1);
    }
  }, []);

  useEffect(() => {
    updateItemsPerPage();
    window.addEventListener('resize', updateItemsPerPage);
    return () => {
      window.removeEventListener('resize', updateItemsPerPage);
    };
  }, [updateItemsPerPage]);

  useEffect(() => {
    setCurrentIndex(0);
  }, [items]);

  const nextItem = async (e) => {
    e.preventDefault();
    e.stopPropagation();
    if (currentIndex + itemsPerPage < items.length) {
      setCurrentIndex(currentIndex + itemsPerPage);
    } else if (onReachEnd) {
      await onReachEnd();
    }
  };

  const prevItem = (e) => {
    e.preventDefault();
    e.stopPropagation();
    if (currentIndex - itemsPerPage >= 0) {
      setCurrentIndex(currentIndex - itemsPerPage);
    }
  };

  const getVisibleItems = () => {
    if (!items.length) return [];
    return items.slice(currentIndex, currentIndex + itemsPerPage);
  };

  return (
    <div className='carousel'>
      {currentIndex > 0 && (
        <button className='carousel-button prev' onClick={prevItem}>
          ‹
        </button>
      )}
      <div className='carousel-items'>
        {getVisibleItems().map((item, index) => (
          <div key={`${item.id}-${index}`} className='carousel-item'>
            <ItemCard
              item={item}
              contentType={item.type}
              isRelated={isRelated}
            />
          </div>
        ))}
        {isLoading && <div className='loading-indicator'>Loading...</div>}
      </div>
      {currentIndex + itemsPerPage < items.length && (
        <button className='carousel-button next' onClick={nextItem}>
          ›
        </button>
      )}
    </div>
  );
});

export default Carousel;
