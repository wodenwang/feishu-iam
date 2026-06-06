import { useEffect, useState } from 'react';

export function useMediaQuery(query: string): boolean {
  const [matches, setMatches] = useState(() => readMediaQuery(query));

  useEffect(() => {
    if (typeof window === 'undefined' || typeof window.matchMedia !== 'function') {
      setMatches(false);
      return;
    }

    const mediaQueryList = window.matchMedia(query);
    const handleChange = () => {
      setMatches(mediaQueryList.matches);
    };

    handleChange();
    mediaQueryList.addEventListener('change', handleChange);
    return () => {
      mediaQueryList.removeEventListener('change', handleChange);
    };
  }, [query]);

  return matches;
}

function readMediaQuery(query: string): boolean {
  if (typeof window === 'undefined' || typeof window.matchMedia !== 'function') {
    return false;
  }

  return window.matchMedia(query).matches;
}
