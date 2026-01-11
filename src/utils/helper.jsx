export const getTitle = (item) => {
  if (!item) return '';

  switch (item.type) {
    case 'movies':
      return item.title || '';
    case 'shows':
      return item.name || item.title || '';
    case 'anime':
      // Anime title can be an object with {romaji, english, native, userPreferred}
      if (typeof item.title === 'object' && item.title !== null) {
        return item.title.english || item.title.userPreferred || item.title.romaji || '';
      }
      return item.title || item.name || '';
    default:
      return item.title || item.name || '';
  }
};

// Clean HTML tags from anime descriptions/overviews
export const cleanHtmlTags = (text) => {
  if (!text) return '';
  
  // Convert <br> tags to spaces (handle <br>, <br/>, </br>)
  let cleaned = text.replace(/<br\s*\/?>/gi, ' ');
  
  // Remove all other HTML tags
  cleaned = cleaned.replace(/<[^>]*>/g, '');
  
  // Decode HTML entities
  cleaned = cleaned.replace(/&nbsp;/g, ' ')
                   .replace(/&amp;/g, '&')
                   .replace(/&lt;/g, '<')
                   .replace(/&gt;/g, '>')
                   .replace(/&quot;/g, '"')
                   .replace(/&#39;/g, "'")
                   .replace(/&apos;/g, "'");
  
  // Clean up multiple spaces and trim
  cleaned = cleaned.replace(/\s+/g, ' ').trim();
  
  return cleaned;
};