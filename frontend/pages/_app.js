import '../styles/globals.css'
import { useEffect } from 'react'
import { getSafeThemeColor } from '../utils/theme'

function MyApp({ Component, pageProps }) {
  useEffect(() => {
    const savedColor = localStorage.getItem('theme_primary_color');
    if (savedColor) {
      document.documentElement.style.setProperty('--color-primary', getSafeThemeColor(savedColor));
    }
  }, []);

  return <Component {...pageProps} />
}

export default MyApp
