// src/screens/HomeScreen.js
import React, { useState, useEffect, useContext, useRef, useCallback, memo } from 'react';
import { 
  View, Text, StyleSheet, Image, TouchableOpacity, 
  ActivityIndicator, FlatList, useWindowDimensions, Animated, RefreshControl,
  DeviceEventEmitter
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { ThemeContext } from '../context/ThemeContext';
import { LibraryContext } from '../context/LibraryContext';
import { useNavigation, useRoute, useFocusEffect } from '@react-navigation/native';
import { SIZES } from '../constants/theme';

const API_KEY = "55550670b2e9a6b8c3c3c69b0bdf894f";
const BASE_URL = "https://api.themoviedb.org/3";

const CARD_TYPES = { LANDSCAPE: 'landscape', PORTRAIT: 'portrait' };
const PORTRAIT_WIDTH = 130;
const LANDSCAPE_WIDTH = 240;
const CARD_MARGIN = 15;

const getGenreGradient = (genreName) => {
  const name = genreName.toLowerCase();
  if (name.includes('action')) return ['#FF416C', '#FF4B2B']; 
  if (name.includes('comedy')) return ['#F2994A', '#F2C94C']; 
  if (name.includes('sci-fi') || name.includes('science')) return ['#00B4DB', '#0083B0']; 
  if (name.includes('horror') || name.includes('thriller')) return ['#141E30', '#243B55']; 
  if (name.includes('romance') || name.includes('drama')) return ['#bc4e9c', '#f80759']; 
  if (name.includes('fantasy') || name.includes('animation') || name.includes('music')) return ['#8E2DE2', '#4A00E0']; 
  if (name.includes('crime') || name.includes('mystery')) return ['#3a7bd5', '#3a6073']; 
  if (name.includes('adventure') || name.includes('history') || name.includes('war')) return ['#654ea3', '#eaafc8']; 
  if (name.includes('family')) return ['#11998E', '#38EF7D']; 
  return ['#4B79A1', '#283E51']; 
};

const fetchData = async (endpoint) => {
  try {
    const res = await fetch(`${BASE_URL}${endpoint}`);
    const data = await res.json();
    return data.results || []; 
  } catch (error) { console.error(error); return []; }
};

const shuffleArray = (array) => {
  let shuffled = [...array];
  for (let i = shuffled.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
  }
  return shuffled;
};

const PaginationDot = memo(({ isActive, theme }) => {
  const widthAnim = useRef(new Animated.Value(isActive ? 24 : 8)).current;
  const opacityAnim = useRef(new Animated.Value(isActive ? 1 : 0.3)).current;

  useEffect(() => {
      Animated.parallel([
          Animated.spring(widthAnim, { toValue: isActive ? 24 : 8, friction: 6, tension: 50, useNativeDriver: false }),
          Animated.timing(opacityAnim, { toValue: isActive ? 1 : 0.3, duration: 150, useNativeDriver: false })
      ]).start();
  }, [isActive]);

  return <Animated.View style={[styles.dot, { width: widthAnim, opacity: opacityAnim, backgroundColor: theme.text }]} />;
});

const HeroPagination = memo(({ heroItems, activeDotIndex, handleDotPress, theme, isDarkMode }) => {
  if (!heroItems || heroItems.length === 0) return null;
  return (
    <View style={[
      styles.paginationContainer, 
      { 
        backgroundColor: isDarkMode ? 'rgba(0,0,0,0.5)' : 'rgba(255,255,255,0.6)',
        borderColor: isDarkMode ? 'rgba(255,255,255,0.15)' : 'rgba(0,0,0,0.15)'
      }
    ]}>
      {heroItems.map((_, i) => (
          <TouchableOpacity key={i} onPress={() => handleDotPress(i)} hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}>
            <PaginationDot isActive={activeDotIndex === i} theme={theme} />
          </TouchableOpacity>
      ))}
    </View>
  );
});

const HeroPlayBtn = memo(({ onPress, theme }) => {
  const scaleAnim = useRef(new Animated.Value(1)).current;
  const handlePress = () => {
    Animated.sequence([
      Animated.timing(scaleAnim, { toValue: 0.9, duration: 80, useNativeDriver: true }),
      Animated.spring(scaleAnim, { toValue: 1, friction: 4, tension: 60, useNativeDriver: true })
    ]).start();
    setTimeout(onPress, 120); 
  };
  return (
    <TouchableOpacity activeOpacity={0.9} onPress={handlePress} style={{flex: 1}}>
      <Animated.View style={[styles.playBtn, { backgroundColor: theme.text, transform: [{ scale: scaleAnim }] }]}>
        <Ionicons name="play" size={24} color={theme.background} />
        <Text style={[styles.playBtnText, { color: theme.background }]}>Play Now</Text>
      </Animated.View>
    </TouchableOpacity>
  );
});

const HeroWatchlistBtn = memo(({ inList, onPress, theme }) => {
  const scaleAnim = useRef(new Animated.Value(1)).current;
  const handlePress = () => {
    Animated.sequence([
      Animated.timing(scaleAnim, { toValue: 0.9, duration: 80, useNativeDriver: true }),
      Animated.spring(scaleAnim, { toValue: 1, friction: 4, tension: 60, useNativeDriver: true })
    ]).start();
    onPress();
  };
  return (
    <TouchableOpacity activeOpacity={0.9} onPress={handlePress} style={{flex: 1}}>
      <Animated.View style={[styles.glassBtn, { backgroundColor: theme.surfaceGlass, borderColor: theme.border, transform: [{ scale: scaleAnim }] }]}>
        <Ionicons name={inList ? "checkmark" : "add"} size={24} color={theme.text} />
        <Text style={[styles.glassBtnText, { color: theme.text }]}>{inList ? 'Added' : 'Watchlist'}</Text>
      </Animated.View>
    </TouchableOpacity>
  );
});

const HeroInfoBtn = memo(({ onPress, theme }) => {
  const scaleAnim = useRef(new Animated.Value(1)).current;
  const handlePress = () => {
    Animated.sequence([
      Animated.timing(scaleAnim, { toValue: 0.8, duration: 80, useNativeDriver: true }),
      Animated.spring(scaleAnim, { toValue: 1, friction: 4, tension: 60, useNativeDriver: true })
    ]).start();
    setTimeout(onPress, 120);
  };
  return (
    <TouchableOpacity activeOpacity={0.9} onPress={handlePress}>
      <Animated.View style={[styles.infoBtn, { backgroundColor: theme.surfaceGlass, borderColor: theme.border, transform: [{ scale: scaleAnim }] }]}>
        <Ionicons name="information" size={24} color={theme.text} />
      </Animated.View>
    </TouchableOpacity>
  );
});

// 🔥 NEW: Contextually Aware Image Fetcher
const ContinueWatchingCard = memo(({ item, theme, navigateToDetails, imgBase }) => {
  const progress = item.savedProgress || 0;
  const finalType = item.finalType || item.type || item.media_type || 'movie';
  const isTvShow = String(finalType).toLowerCase() === 'tv';
  
  const scale = useRef(new Animated.Value(1)).current;
  const imagePath = item.episode_still_path || item.backdrop_path || item.poster_path;

  return (
    <TouchableOpacity 
      activeOpacity={1} 
      onPressIn={() => Animated.timing(scale, { toValue: 0.96, duration: 60, useNativeDriver: true }).start()} 
      onPressOut={() => Animated.spring(scale, { toValue: 1, friction: 5, tension: 80, useNativeDriver: true }).start()} 
      onPress={() => navigateToDetails(item.id, finalType, item.last_watched_season, item.last_watched_episode)} 
      style={{ marginRight: CARD_MARGIN }}
    >
      <Animated.View style={[styles.cardWrapper, { width: LANDSCAPE_WIDTH, height: 135, transform: [{ scale }] }]}>
        <Image source={{ uri: `${imgBase}${imagePath}` }} style={[styles.cardImage, styles.landscapeCard, { borderColor: theme.border }]} />
        <View style={[StyleSheet.absoluteFillObject, styles.overlayBase]}>
          
          {isTvShow && item.last_watched_season && item.last_watched_episode && (
              <View style={[styles.seasonEpisodeBadge, { backgroundColor: theme.primary }]}>
                  <Text style={styles.seasonEpisodeText}>
                      S{item.last_watched_season} E{item.last_watched_episode}
                  </Text>
              </View>
          )}

          <View style={styles.progressBarBg}>
            <View style={[styles.progressBarFill, { width: `${progress * 100}%`, backgroundColor: theme.primary }]} />
          </View>
          
          <LinearGradient colors={['transparent', 'rgba(0,0,0,0.7)', 'rgba(0,0,0,0.95)']} style={styles.cardGradientBottom}>
            <Text style={styles.cardOverlayTitle} numberOfLines={1}>{item.title || item.name}</Text>
          </LinearGradient>
          
          <View style={styles.playOverlay}>
             <Ionicons name="play-circle-outline" size={40} color="#fff" />
          </View>
        </View>
      </Animated.View>
    </TouchableOpacity>
  );
});

const ContinueWatchingRow = memo(({ data, theme, navigateToDetails, imgBase }) => {
  if (!data || data.length === 0) return null;
  const snapInterval = LANDSCAPE_WIDTH + CARD_MARGIN;
  const getItemLayout = (d, index) => ({ length: snapInterval, offset: snapInterval * index, index });

  return (
    <View style={[styles.rowContainer, { marginTop: 15 }]}>
      <Text style={[styles.rowTitle, { color: theme.text }]}>Continue Watching</Text>
      <FlatList
        horizontal showsHorizontalScrollIndicator={false} data={data}
        keyExtractor={(item) => `cw-${item.id}`}
        contentContainerStyle={{ paddingLeft: SIZES.padding, paddingRight: SIZES.padding }}
        snapToInterval={snapInterval} snapToAlignment="start" decelerationRate="fast"
        getItemLayout={getItemLayout} initialNumToRender={4} windowSize={3}
        renderItem={({ item }) => (
          <ContinueWatchingCard item={item} theme={theme} navigateToDetails={navigateToDetails} imgBase={imgBase} />
        )}
      />
    </View>
  );
});

const MovieCard = memo(({ item, isPortrait, theme, tappedCardId, setTappedCardId, navigateToDetails, imgBase }) => {
  const isTapped = tappedCardId === item.id;
  const mediaType = item.media_type || (item.name || item.first_air_date ? 'tv' : 'movie');
  const [bannerText, setBannerText] = useState(null);
  const [hasMounted, setHasMounted] = useState(false); 
  const [progress, setProgress] = useState(0); 

  const { toggleWatchlist, isInWatchlist } = useContext(LibraryContext);
  const inList = isInWatchlist(item.id);

  const fadeAnim = useRef(new Animated.Value(0)).current;
  const cardScale = useRef(new Animated.Value(1)).current;
  const iconScale = useRef(new Animated.Value(1)).current;

  useEffect(() => {
    let isMounted = true;
    let timeoutId;

    const checkBannerStatus = () => {
      if (item.release_date && new Date(item.release_date) > new Date()) {
        if (isMounted) setBannerText("Coming Soon");
        return;
      }
      if (mediaType === 'tv') {
        const delay = Math.floor(Math.random() * 2500) + 100;
        timeoutId = setTimeout(async () => {
          if (!isMounted) return;
          try {
            const res = await fetch(`${BASE_URL}/tv/${item.id}?api_key=${API_KEY}`);
            if (!res.ok) return;
            const tvShow = await res.json();
            if (!tvShow || !tvShow.last_air_date) return;
            const lastAirDate = new Date(tvShow.last_air_date);
            const oneMonthAgo = new Date();
            oneMonthAgo.setMonth(new Date().getMonth() - 1);
            if (lastAirDate >= oneMonthAgo) {
                if (tvShow.last_episode_to_air?.episode_number === 1 && new Date(tvShow.last_episode_to_air.air_date) >= oneMonthAgo) {
                    if (isMounted) setBannerText("New Season");
                } else {
                    if (isMounted) setBannerText("New Episode");
                }
            }
          } catch (error) {}
        }, delay);
      }
    };
    
    const fetchProgress = async () => {
      try {
         const str = await AsyncStorage.getItem(`nuvix_prog_${item.id}`);
         if (str && isMounted) {
            const pData = JSON.parse(str);
            let maxP = 0;
            for (let key in pData) {
               if (pData[key] > maxP) maxP = pData[key];
            }
            setProgress(maxP);
         }
      } catch(e){}
    };
    
    checkBannerStatus();
    fetchProgress();
    
    return () => { 
      isMounted = false; 
      if (timeoutId) clearTimeout(timeoutId);
    };
  }, [item.id, item.release_date, item.first_air_date, mediaType]);

  useEffect(() => {
    if (isTapped) {
      setHasMounted(true);
      Animated.timing(fadeAnim, { toValue: 1, duration: 80, useNativeDriver: true }).start();
    } else if (hasMounted) {
      Animated.timing(fadeAnim, { toValue: 0, duration: 150, useNativeDriver: true }).start();
    }
  }, [isTapped]);

  const handlePressIn = () => Animated.timing(cardScale, { toValue: 0.96, duration: 60, useNativeDriver: true }).start();
  const handlePressOut = () => Animated.spring(cardScale, { toValue: 1, friction: 5, tension: 80, useNativeDriver: true }).start();

  const handlePress = () => {
    if (isTapped) {
      navigateToDetails(item.id, mediaType);
    } else {
      Animated.sequence([
        Animated.timing(cardScale, { toValue: 0.95, duration: 60, useNativeDriver: true }),
        Animated.spring(cardScale, { toValue: 1, friction: 5, tension: 80, useNativeDriver: true })
      ]).start();
      setTappedCardId(item.id);
    }
  };

  const handleWatchlistPress = () => {
    Animated.sequence([
      Animated.timing(iconScale, { toValue: 1.4, duration: 100, useNativeDriver: true }),
      Animated.spring(iconScale, { toValue: 1, friction: 4, tension: 60, useNativeDriver: true })
    ]).start();
    toggleWatchlist({ ...item, media_type: mediaType });
    setTimeout(() => setTappedCardId(null), 300); 
  };

  const isFullyWatched = progress >= 0.95;
  const isPartiallyWatched = progress > 0 && progress < 0.95;

  return (
    <TouchableOpacity activeOpacity={1} delayPressIn={0} onPressIn={handlePressIn} onPressOut={handlePressOut} onPress={handlePress} style={{ marginRight: CARD_MARGIN }}>
      <Animated.View style={[styles.cardWrapper, { transform: [{ scale: cardScale }] }]}>
        {/* 🔥 Data Saver Logic Applied */}
        <Image source={{ uri: `${imgBase}${isPortrait ? item.poster_path : item.backdrop_path}` }} style={[styles.cardImage, isPortrait ? styles.portraitCard : styles.landscapeCard, { borderColor: theme.border }]} />
        
        {isFullyWatched && <View style={styles.watchedOverlay} />}
        
        {bannerText && !isFullyWatched && (
          <View style={[styles.bannerTag, { backgroundColor: theme.primary }]}>
            <Text style={styles.bannerText}>{bannerText}</Text>
          </View>
        )}
        
        {isFullyWatched && (
          <View style={[styles.watchedBadge, { backgroundColor: theme.primary }]}>
            <Ionicons name="checkmark" size={9} color="#fff" />
            <Text style={styles.watchedBadgeText}>WATCHED</Text>
          </View>
        )}

        {(isPartiallyWatched || isFullyWatched) && (
           <View style={styles.progressBarBg}>
             <View style={[styles.progressBarFill, { width: `${progress * 100}%`, backgroundColor: theme.primary }]} />
           </View>
        )}

        {hasMounted && (
          <Animated.View pointerEvents={isTapped ? "auto" : "none"} style={[StyleSheet.absoluteFillObject, styles.overlayBase, { opacity: fadeAnim }]}>
            <TouchableOpacity style={styles.addToListTopRight} delayPressIn={0} onPress={handleWatchlistPress}>
               <Animated.View style={{ transform: [{ scale: iconScale }] }}>
                 <Ionicons name={inList ? "checkmark-circle" : "add-circle"} size={32} color={inList ? theme.primary : "#fff"} style={styles.iconDropShadow} />
               </Animated.View>
            </TouchableOpacity>
            <LinearGradient colors={['transparent', 'rgba(0,0,0,0.7)', 'rgba(0,0,0,0.95)']} style={styles.cardGradientBottom}>
              <Text style={styles.cardOverlayTitle} numberOfLines={2}>{item.title || item.name}</Text>
            </LinearGradient>
          </Animated.View>
        )}
      </Animated.View>
    </TouchableOpacity>
  );
});

const MovieRow = memo(({ title, data, type, theme, tappedCardId, setTappedCardId, navigateToDetails, imgBase }) => {
  if (!data || data.length === 0) return null;
  const isPortrait = type === CARD_TYPES.PORTRAIT;
  const snapInterval = isPortrait ? (PORTRAIT_WIDTH + CARD_MARGIN) : (LANDSCAPE_WIDTH + CARD_MARGIN);

  const getItemLayout = (data, index) => ({ length: snapInterval, offset: snapInterval * index, index });

  return (
    <View style={styles.rowContainer}>
      <Text style={[styles.rowTitle, { color: theme.text }]}>{title}</Text>
      <FlatList
        horizontal showsHorizontalScrollIndicator={false} data={data}
        keyExtractor={(item) => item.id.toString()}
        contentContainerStyle={{ paddingLeft: SIZES.padding, paddingRight: SIZES.padding }}
        snapToInterval={snapInterval} snapToAlignment="start" decelerationRate="fast"
        getItemLayout={getItemLayout} initialNumToRender={4} maxToRenderPerBatch={4} windowSize={3} removeClippedSubviews={true} 
        onScrollBeginDrag={() => setTappedCardId(null)}
        renderItem={({ item }) => (
          <MovieCard 
            item={item} isPortrait={isPortrait} theme={theme} tappedCardId={tappedCardId} 
            setTappedCardId={setTappedCardId} navigateToDetails={navigateToDetails} imgBase={imgBase}
          />
        )}
      />
    </View>
  );
});

export default function HomeScreen() {
  // 🔥 EXTRACTING DATA SAVER PREFERENCE
  const { theme, isDarkMode, dataSaver } = useContext(ThemeContext);
  const { toggleWatchlist, isInWatchlist, history } = useContext(LibraryContext); 
  const navigation = useNavigation();
  const route = useRoute();
  
  // DYNAMIC IMAGE QUALITIES
  const imgQualityBase = dataSaver ? "https://image.tmdb.org/t/p/w342" : "https://image.tmdb.org/t/p/w500";
  const heroQualityBase = dataSaver ? "https://image.tmdb.org/t/p/w780" : "https://image.tmdb.org/t/p/original";

  const { width, height } = useWindowDimensions();
  const isTablet = width >= 768;
  const isTabletLandscape = isTablet && width > height;

  const heroWidth = isTabletLandscape ? (width - 250) : width;
  const heroHeight = isTablet ? 600 : height * 0.65;

  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  
  const [heroItems, setHeroItems] = useState([]);
  const [rows, setRows] = useState([]);
  const [genres, setGenres] = useState([]);
  const [continueWatchingData, setContinueWatchingData] = useState([]); 
  
  const [tappedCardId, setTappedCardId] = useState(null); 
  
  const heroRef = useRef(null);
  const scrollX = useRef(new Animated.Value(0)).current; 
  const currentIndexRef = useRef(0);
  const timerRef = useRef(null);
  const category = route.params?.category || 'Home'; 

  const activeDotIndexRef = useRef(0);
  const [activeDotIndex, setActiveDotIndex] = useState(0);

  const isScrolledRef = useRef(false);

  const handleScroll = useCallback((e) => {
    const y = e.nativeEvent.contentOffset.y;
    if (y > 50 && !isScrolledRef.current) {
      isScrolledRef.current = true;
      DeviceEventEmitter.emit('navScroll', true);
    } else if (y <= 50 && isScrolledRef.current) {
      isScrolledRef.current = false;
      DeviceEventEmitter.emit('navScroll', false);
    }
  }, []);

  useFocusEffect(
    useCallback(() => {
      DeviceEventEmitter.emit('navScroll', isScrolledRef.current);
      
      const fetchContinueWatching = async () => {
        if (!history || history.length === 0) return;
        const cwList = [];
        
        for (const item of history.slice(0, 20)) {
          try {
            const rawType = item.type || item.media_type;
            const mediaType = rawType ? String(rawType).toLowerCase() : 'movie';

            let localProg = 0;
            const progStr = await AsyncStorage.getItem(`nuvix_prog_${item.id}`);
            if (progStr) {
                const progData = JSON.parse(progStr);
                if (mediaType === 'movie') {
                    localProg = progData['1-1'] || 0;
                } else if (item.last_watched_season && item.last_watched_episode) {
                    localProg = progData[`${item.last_watched_season}-${item.last_watched_episode}`] || 0;
                }
            }

            let cloudProg = 0;
            if (item.progressMap) {
                if (mediaType === 'movie') {
                    cloudProg = item.progressMap['1-1'] || 0;
                } else if (item.last_watched_season && item.last_watched_episode) {
                    cloudProg = item.progressMap[`${item.last_watched_season}-${item.last_watched_episode}`] || 0;
                }
            }

            let p = Math.max(item.savedProgress || 0, localProg, cloudProg);
            if (isNaN(p)) p = 0;
            
            if (mediaType === 'movie') {
                if (p > 0 && p < 0.95) cwList.push({...item, savedProgress: p, finalType: mediaType});
            } else {
                if (item.last_watched_season && item.last_watched_episode) {
                    if (p < 0.95) cwList.push({...item, savedProgress: p > 0 ? p : 0.05, finalType: mediaType});
                }
            }
          } catch(e) {}
        }
        setContinueWatchingData(cwList);
      };
      
      fetchContinueWatching();
    }, [history])
  );

  const startAutoplay = useCallback(() => {
    clearInterval(timerRef.current);
    timerRef.current = setInterval(() => {
        if (heroRef.current && heroItems.length > 0) {
            const maxIndex = (heroItems.length * 50) - 1; 
            let nextIdx = currentIndexRef.current + 1;
            
            if (nextIdx > maxIndex) {
                nextIdx = heroItems.length * 25;
                heroRef.current.scrollToIndex({ index: nextIdx, animated: false });
            } else {
                heroRef.current.scrollToIndex({ index: nextIdx, animated: true });
            }
        }
    }, 8000);
  }, [heroItems.length]);

  const stopAutoplay = useCallback(() => {
    clearInterval(timerRef.current);
  }, []);

  useEffect(() => {
    if (heroItems.length === 0) return;

    const listener = scrollX.addListener(({ value }) => {
      const absoluteIndex = Math.round(value / heroWidth);
      const dotIndex = absoluteIndex % heroItems.length;
      if (dotIndex !== activeDotIndexRef.current && !isNaN(dotIndex)) {
          activeDotIndexRef.current = dotIndex;
          setActiveDotIndex(dotIndex);
      }
    });

    const firstMove = setTimeout(() => {
        if (heroRef.current) {
            const maxIndex = (heroItems.length * 50) - 1;
            let nextIdx = currentIndexRef.current + 1;
            if (nextIdx <= maxIndex) {
                heroRef.current.scrollToIndex({ index: nextIdx, animated: true });
            }
            startAutoplay();
        }
    }, 2500);

    return () => {
        clearTimeout(firstMove);
        stopAutoplay();
        scrollX.removeListener(listener);
    };
  }, [heroItems.length, heroWidth, startAutoplay, stopAutoplay]);

  const handleDotPress = useCallback((targetOriginalIndex) => {
    if (!heroRef.current || heroItems.length === 0) return;
    const currentModulo = currentIndexRef.current % heroItems.length;
    const diff = targetOriginalIndex - currentModulo;
    let targetAbsoluteIndex = currentIndexRef.current + diff;
    
    const maxIndex = (heroItems.length * 50) - 1;
    if (targetAbsoluteIndex < 0) {
        targetAbsoluteIndex += heroItems.length;
    } else if (targetAbsoluteIndex > maxIndex) {
        targetAbsoluteIndex -= heroItems.length;
    }
    
    heroRef.current.scrollToIndex({ index: targetAbsoluteIndex, animated: true });
    startAutoplay(); 
  }, [heroItems.length, startAutoplay]);

  const loadAllContent = async (isRefresh = false) => {
    if (isRefresh) setRefreshing(true);
    else setLoading(true); 
    
    const today = new Date().toISOString().split('T')[0];
    let heroSources = [];
    let rowConfigs = [];

    if (category === 'Movies') {
      heroSources = ['/movie/popular'];
      rowConfigs = [
        { title: "Trending Movies", endpoint: '/trending/movie/week', type: CARD_TYPES.PORTRAIT },
        { title: "Top Rated Movies", endpoint: '/movie/top_rated', type: CARD_TYPES.LANDSCAPE }, 
        { title: "Popular Movies", endpoint: '/movie/popular', type: CARD_TYPES.LANDSCAPE }, 
        { title: "Upcoming Movies", endpoint: '/movie/upcoming', type: CARD_TYPES.PORTRAIT },
        { title: "Action & Adventure", endpoint: '/discover/movie?with_genres=28', type: CARD_TYPES.LANDSCAPE }, 
        { title: "Sci-Fi Worlds", endpoint: '/discover/movie?with_genres=878', type: CARD_TYPES.PORTRAIT },
      ];
    } else if (category === 'TV Shows') {
      heroSources = ['/trending/tv/week'];
      rowConfigs = [
        { title: "Trending TV Shows (This Week)", endpoint: '/trending/tv/week', type: CARD_TYPES.LANDSCAPE }, 
        { title: "Netflix Original Series", endpoint: '/discover/tv?with_networks=213&sort_by=popularity.desc', type: CARD_TYPES.PORTRAIT },
        { title: "Newest Released TV Shows", endpoint: '/discover/tv?sort_by=first_air_date.desc&vote_count.gte=100', type: CARD_TYPES.LANDSCAPE }, 
        { title: "Most High Rated TV Shows", endpoint: '/tv/top_rated', type: CARD_TYPES.PORTRAIT },
        { title: "Popular TV Shows (Overall)", endpoint: '/tv/popular', type: CARD_TYPES.LANDSCAPE }, 
        { title: "Comedies", endpoint: '/discover/tv?with_genres=35', type: CARD_TYPES.PORTRAIT },
      ];
    } else if (category === 'Originals') {
      heroSources = ['/discover/tv?with_networks=213&sort_by=popularity.desc'];
      rowConfigs = [
        { title: "Trending Originals", endpoint: '/discover/tv?with_networks=213&sort_by=popularity.desc', type: CARD_TYPES.LANDSCAPE }, 
        { title: "New Releases", endpoint: '/discover/tv?with_networks=213&sort_by=first_air_date.desc', type: CARD_TYPES.PORTRAIT },
        { title: "Action Packed", endpoint: '/discover/tv?with_networks=213&with_genres=10759', type: CARD_TYPES.LANDSCAPE }, 
        { title: "Comedy Originals", endpoint: '/discover/tv?with_networks=213&with_genres=35', type: CARD_TYPES.PORTRAIT },
        { title: "Sci-Fi & Fantasy", endpoint: '/discover/tv?with_networks=213&with_genres=10765', type: CARD_TYPES.LANDSCAPE }, 
        { title: "Award-Winning Dramas", endpoint: '/discover/tv?with_networks=213&with_genres=18', type: CARD_TYPES.PORTRAIT },
      ];
    } else if (category === 'Kids') {
      heroSources = ['/discover/movie?with_genres=10751&sort_by=popularity.desc'];
      rowConfigs = [
        { title: "Popular Kids TV", endpoint: '/discover/tv?with_genres=10762&sort_by=popularity.desc', type: CARD_TYPES.LANDSCAPE }, 
        { title: "Family Movies", endpoint: '/discover/movie?with_genres=10751&sort_by=vote_average.desc&vote_count.gte=500', type: CARD_TYPES.PORTRAIT },
        { title: "Animated Masterpieces", endpoint: '/discover/movie?with_genres=16', type: CARD_TYPES.LANDSCAPE }, 
        { title: "Family Comedies", endpoint: '/discover/movie?with_genres=10751,35', type: CARD_TYPES.PORTRAIT },
        { title: "More Kids Cartoons", endpoint: '/discover/tv?with_genres=16,10762', type: CARD_TYPES.LANDSCAPE },
      ];
    } else {
      heroSources = ['/movie/popular', '/trending/tv/week'];
      rowConfigs = [
          { title: "Coming Soon", endpoint: `/discover/movie?sort_by=popularity.desc&primary_release_date.gte=${today}`, type: CARD_TYPES.LANDSCAPE },
          { title: "Trending Movies", endpoint: '/trending/movie/week', type: CARD_TYPES.PORTRAIT },
          { title: "Popular Movies", endpoint: '/movie/popular', type: CARD_TYPES.LANDSCAPE },
          { title: "Top Rated Movies", endpoint: '/movie/top_rated', type: CARD_TYPES.PORTRAIT },
          { title: "Trending TV Shows", endpoint: '/trending/tv/week', type: CARD_TYPES.LANDSCAPE },
          { title: "Popular TV Shows", endpoint: '/tv/popular', type: CARD_TYPES.PORTRAIT },
          { title: "On The Air TV Shows", endpoint: '/tv/on_the_air', type: CARD_TYPES.LANDSCAPE },
          { title: "Animated Adventures", endpoint: '/discover/movie?with_genres=16&sort_by=popularity.desc', type: CARD_TYPES.PORTRAIT },
          { title: "Sci-Fi Worlds", endpoint: '/discover/movie?with_genres=878&sort_by=popularity.desc', type: CARD_TYPES.LANDSCAPE },
          { title: "Best of the 90s", endpoint: '/discover/movie?primary_release_date.gte=1990-01-01&primary_release_date.lte=1999-12-31&sort_by=vote_average.desc&vote_count.gte=500', type: CARD_TYPES.PORTRAIT }
      ];
    }

    const displayedIds = new Set();
    const filterDupes = (items) => items.filter(item => {
        const key = `${item.id}`;
        if (displayedIds.has(key)) return false;
        displayedIds.add(key); return true;
    });

    try {
      const heroFetches = heroSources.map(src => fetchData(`${src}${src.includes('?') ? '&' : '?'}api_key=${API_KEY}`));
      const primaryRowFetches = rowConfigs.slice(0, 2).map(config => fetchData(`${config.endpoint}${config.endpoint.includes('?') ? '&' : '?'}api_key=${API_KEY}`));
      
      const [heroResultsArray, primaryRowsData, genreData] = await Promise.all([
        Promise.all(heroFetches),
        Promise.all(primaryRowFetches),
        fetch(`${BASE_URL}/genre/${category === 'TV Shows' ? 'tv' : 'movie'}/list?api_key=${API_KEY}`).then(res=>res.json())
      ]);

      let rawHero = [];
      heroResultsArray.forEach(res => rawHero.push(...res));
      rawHero = shuffleArray(rawHero).slice(0, 8); 

      const detailedHero = await Promise.all(
        rawHero.map(async (item) => {
          const mediaType = item.media_type || (item.first_air_date ? 'tv' : 'movie');
          const res = await fetch(`${BASE_URL}/${mediaType}/${item.id}?api_key=${API_KEY}&append_to_response=images&include_image_language=en,null`);
          const details = await res.json();
          return { ...item, ...details };
        })
      );
      setHeroItems(detailedHero.filter(i => i.backdrop_path));

      const formattedPrimaryRows = rowConfigs.slice(0, 2).map((config, index) => ({
         ...config,
         data: filterDupes(primaryRowsData[index])
      }));

      setRows(formattedPrimaryRows);
      setGenres(genreData.genres || []);

      setLoading(false);
      if (isRefresh) setRefreshing(false);

      if (rowConfigs.length > 2) {
          const secondaryRowConfigs = rowConfigs.slice(2);
          const secondaryRowFetches = secondaryRowConfigs.map(config => fetchData(`${config.endpoint}${config.endpoint.includes('?') ? '&' : '?'}api_key=${API_KEY}`));
          const secondaryRowsData = await Promise.all(secondaryRowFetches);

          const formattedSecondaryRows = secondaryRowConfigs.map((config, index) => ({
              ...config,
              data: filterDupes(secondaryRowsData[index])
          }));

          setRows(prev => [...prev, ...formattedSecondaryRows]);
      }

    } catch(err) {
      console.error(err);
      setLoading(false);
      setRefreshing(false);
    }
  };

  useEffect(() => { loadAllContent(); }, [category]);

  const onRefresh = useCallback(() => { loadAllContent(true); }, [category]); 

  const onViewableItemsChanged = useRef(({ viewableItems }) => {
    if (viewableItems.length > 0) {
        currentIndexRef.current = viewableItems[0].index;
    }
  }).current;

  const navigateToDetails = useCallback((id, media_type, season = null, episode = null) => {
    const type = media_type || (id > 100000 ? 'movie' : 'tv');
    setTappedCardId(null);
    navigation.navigate('Details', { id, type, autoPlaySeason: season, autoPlayEpisode: episode }); 
  }, [navigation]);

  if (loading) {
    return (
      <View style={[styles.centered, { backgroundColor: theme.background }]}>
        <ActivityIndicator size="large" color={theme.primary} />
      </View>
    );
  }

  const loopedHeroItems = heroItems.length > 0 ? Array(50).fill(heroItems).flat() : [];
  const middleInitialIndex = heroItems.length > 0 ? heroItems.length * 25 : 0;
  
  const gradientMiddle = isDarkMode ? 'rgba(0,0,0,0.6)' : 'rgba(255,255,255,0.6)';
  const gradientSide = isDarkMode ? 'rgba(0,0,0,0.8)' : 'rgba(255,255,255,0.9)';
  const shadowColor = isDarkMode ? '#000' : 'transparent';
  
  const getHeroItemLayout = (data, index) => ({ length: heroWidth, offset: heroWidth * index, index });

  const renderHeroItem = ({ item, index }) => {
    const logoObj = item.images?.logos?.find(l => l.iso_639_1 === 'en') || item.images?.logos?.[0];
    const releaseYear = (item.release_date || item.first_air_date || '').substring(0, 4);
    const mediaType = item.first_air_date ? 'tv' : 'movie';
    const heroImagePath = item.backdrop_path || item.poster_path;
    const inList = isInWatchlist(item.id);

    const inputRange = [(index - 1) * heroWidth, index * heroWidth, (index + 1) * heroWidth];
    
    const opacity = scrollX.interpolate({
      inputRange,
      outputRange: [0.3, 1, 0.3],
      extrapolate: 'clamp',
    });

    const scale = scrollX.interpolate({
      inputRange,
      outputRange: [0.93, 1, 0.93],
      extrapolate: 'clamp',
    });

    return (
      <Animated.View style={[styles.heroContainer, { width: heroWidth, height: heroHeight, opacity, transform: [{ scale }] }]}>
        {/* 🔥 Data Saver Logic Applied */}
        <Image source={{ uri: `${heroQualityBase}${heroImagePath}` }} style={styles.heroImage} />
        
        <LinearGradient colors={['rgba(0,0,0,0.85)', 'transparent']} style={styles.heroGradientTop}/>
        <LinearGradient colors={['transparent', gradientMiddle, theme.background]} style={styles.heroGradientBottom}/>
        <LinearGradient colors={[gradientSide, 'transparent']} start={{ x: 0, y: 0 }} end={{ x: 0.8, y: 0 }} style={styles.heroGradientSide}/>

        <View style={[styles.heroContent, isTablet && styles.heroContentTablet]}>
          {logoObj ? (
            <Image source={{ uri: `https://image.tmdb.org/t/p/w300${logoObj.file_path}` }} style={styles.heroLogo} resizeMode="contain" />
          ) : (
            <Text style={[styles.heroTitleText, { color: theme.text, textShadowColor: shadowColor }]}>{item.title || item.name}</Text>
          )}
          
          <View style={styles.metadataRow}>
            <View style={[styles.metaPill, { backgroundColor: theme.surfaceGlass, borderColor: theme.border, borderWidth: 1 }]}>
              <Ionicons name="star" size={12} color={theme.text} />
              <Text style={{ color: theme.text, fontSize: 12, fontWeight: 'bold' }}>{item.vote_average?.toFixed(1)}</Text>
            </View>
            <View style={[styles.metaPill, { backgroundColor: theme.surfaceGlass, borderColor: theme.border, borderWidth: 1 }]}>
              <Text style={{ color: theme.text, fontSize: 12, fontWeight: 'bold' }}>{releaseYear}</Text>
            </View>
          </View>
          
          <Text style={[styles.heroOverview, { color: theme.textSecondary, textShadowColor: shadowColor }]} numberOfLines={3}>{item.overview}</Text>
          
          <View style={styles.heroButtons}>
            <HeroPlayBtn theme={theme} onPress={() => navigateToDetails(item.id, mediaType)} />
            <HeroWatchlistBtn theme={theme} inList={inList} onPress={() => toggleWatchlist({ ...item, media_type: mediaType })} />
            <HeroInfoBtn theme={theme} onPress={() => navigateToDetails(item.id, mediaType)} />
          </View>
        </View>
      </Animated.View>
    );
  };

  return (
    <View style={[styles.container, { backgroundColor: theme.background }]}>
      <FlatList
        data={rows}
        keyExtractor={(item, index) => `${item.title}-${index}`}
        showsVerticalScrollIndicator={false}
        bounces={true}
        onScroll={handleScroll}
        scrollEventThrottle={16}
        onScrollBeginDrag={() => setTappedCardId(null)}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={theme.primary} />}
        contentContainerStyle={{ paddingBottom: isTabletLandscape ? 20 : 70 }}
        
        ListHeaderComponent={
          <View style={{ marginBottom: 10 }}>
            <View style={{ height: heroHeight }}>
                {loopedHeroItems.length > 0 && (
                  <Animated.FlatList 
                    ref={heroRef} 
                    data={loopedHeroItems} 
                    horizontal 
                    showsHorizontalScrollIndicator={false} 
                    keyExtractor={(item, index) => `hero-${item.id}-${index}`} 
                    renderItem={renderHeroItem} 
                    onViewableItemsChanged={onViewableItemsChanged} 
                    viewabilityConfig={{ itemVisiblePercentThreshold: 50 }} 
                    getItemLayout={getHeroItemLayout} 
                    initialNumToRender={2}
                    initialScrollIndex={middleInitialIndex} 
                    pagingEnabled={!isTabletLandscape}
                    snapToInterval={isTabletLandscape ? heroWidth : undefined}
                    snapToAlignment="center"
                    decelerationRate="fast"
                    disableIntervalMomentum={true}
                    scrollEventThrottle={16} 
                    onScrollBeginDrag={stopAutoplay}
                    onScrollEndDrag={startAutoplay}
                    onMomentumScrollEnd={startAutoplay}
                    onScroll={Animated.event(
                      [{ nativeEvent: { contentOffset: { x: scrollX } } }],
                      { useNativeDriver: false } 
                    )}
                  />
                )}
                
                <HeroPagination 
                   heroItems={heroItems} 
                   activeDotIndex={activeDotIndex} 
                   handleDotPress={handleDotPress} 
                   theme={theme} 
                   isDarkMode={isDarkMode}
                />
            </View>
            
            <ContinueWatchingRow data={continueWatchingData} theme={theme} navigateToDetails={navigateToDetails} imgBase={imgQualityBase} />
          </View>
        }
        
        renderItem={({ item }) => (
          <MovieRow title={item.title} data={item.data} type={item.type} theme={theme} tappedCardId={tappedCardId} setTappedCardId={setTappedCardId} navigateToDetails={navigateToDetails} imgBase={imgQualityBase} />
        )}
        
        ListFooterComponent={
          <View style={styles.genresSection}>
            <Text style={[styles.sectionTitle, { color: theme.textSecondary }]}>Explore {category === 'TV Shows' ? 'TV' : 'Movie'} Categories</Text>
            <FlatList
              horizontal showsHorizontalScrollIndicator={false} data={genres}
              keyExtractor={(item) => item.id.toString()}
              contentContainerStyle={{ paddingLeft: SIZES.padding, paddingBottom: 20 }}
              decelerationRate="fast"
              renderItem={({ item }) => {
                const gradientColors = getGenreGradient(item.name);
                return (
                  <TouchableOpacity activeOpacity={0.8} onPress={() => navigation.navigate('Browse', { selectedGenreId: item.id })}>
                    <LinearGradient colors={gradientColors} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={[styles.genrePill, { borderColor: theme.border }]}>
                      <Text style={[styles.genrePillText, { color: '#ffffff' }]} numberOfLines={1}>{item.name}</Text>
                      <Ionicons name="chevron-forward" size={12} color="rgba(255,255,255,0.8)" style={{marginLeft: 5}} />
                    </LinearGradient>
                  </TouchableOpacity>
                );
              }}
            />
          </View>
        }
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  centered: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  
  heroContainer: { position: 'relative' },
  heroImage: { width: '100%', height: '100%', resizeMode: 'cover', borderRadius: 8 }, 
  heroGradientTop: { position: 'absolute', top: 0, left: 0, right: 0, height: 140 }, 
  heroGradientBottom: { position: 'absolute', bottom: 0, left: 0, right: 0, height: '60%' },
  heroGradientSide: { position: 'absolute', top: 0, bottom: 0, left: 0, width: '70%' },
  heroContent: { position: 'absolute', bottom: 60, left: 20, right: 20, alignItems: 'flex-start' },
  heroContentTablet: { left: 50, right: '30%', bottom: 80 },
  heroLogo: { width: 280, height: 100, marginBottom: 15, alignSelf: 'flex-start' },
  heroTitleText: { fontSize: 36, fontWeight: '900', marginBottom: 15, textShadowRadius: 10 },
  metadataRow: { flexDirection: 'row', gap: 10, marginBottom: 15 },
  metaPill: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 10, paddingVertical: 4, borderRadius: 12, gap: 5 },
  heroOverview: { fontSize: 14, lineHeight: 22, marginBottom: 25, maxWidth: 500, textShadowRadius: 5 },
  
  heroButtons: { flexDirection: 'row', gap: 15, alignItems: 'center', width: '100%', maxWidth: 400 },
  playBtn: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', paddingVertical: 12, borderRadius: 30, gap: 8 },
  playBtnText: { fontSize: 16, fontWeight: 'bold' },
  glassBtn: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', paddingVertical: 12, borderRadius: 30, borderWidth: 1, gap: 8 },
  glassBtnText: { fontSize: 16, fontWeight: 'bold' },
  infoBtn: { width: 50, height: 50, borderRadius: 25, borderWidth: 1, justifyContent: 'center', alignItems: 'center' },
  
  paginationContainer: { 
    position: 'absolute', 
    bottom: 20, 
    right: 25, 
    flexDirection: 'row', 
    alignItems: 'center', 
    gap: 8,
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 20,
    borderWidth: 1,
  },
  dot: { height: 8, borderRadius: 4 },

  contentPadding: { paddingBottom: 20, paddingTop: 10 },
  rowContainer: { marginBottom: 30 },
  rowTitle: { fontSize: 20, fontWeight: 'bold', marginLeft: SIZES.padding, marginBottom: 15 },
  
  cardWrapper: { position: 'relative' },
  cardImage: { borderRadius: 8, borderWidth: 1, backgroundColor: 'rgba(255,255,255,0.05)' },
  portraitCard: { width: PORTRAIT_WIDTH, height: 195 },
  landscapeCard: { width: LANDSCAPE_WIDTH, height: 135 },
  
  bannerTag: { position: 'absolute', top: 10, left: 0, paddingHorizontal: 8, paddingVertical: 4, borderTopRightRadius: 4, borderBottomRightRadius: 4, zIndex: 5 },
  bannerText: { color: '#fff', fontSize: 10, fontWeight: 'bold', textTransform: 'uppercase' },
  
  seasonEpisodeBadge: { position: 'absolute', top: 6, left: 6, paddingHorizontal: 6, paddingVertical: 3, borderRadius: 4, zIndex: 15, elevation: 5 },
  seasonEpisodeText: { color: '#fff', fontSize: 10, fontWeight: 'bold', letterSpacing: 0.5 },
  
  overlayBase: { borderRadius: 8, zIndex: 10, overflow: 'hidden' },
  watchedOverlay: { ...StyleSheet.absoluteFillObject, backgroundColor: 'rgba(0,0,0,0.45)', borderRadius: 8, zIndex: 1 },
  watchedBadge: { position: 'absolute', top: 6, left: 6, flexDirection: 'row', alignItems: 'center', paddingHorizontal: 5, paddingVertical: 3, borderRadius: 4, gap: 2, zIndex: 15 },
  watchedBadgeText: { color: '#fff', fontSize: 8, fontWeight: 'bold', letterSpacing: 0.5 },
  progressBarBg: { position: 'absolute', bottom: 0, left: 0, right: 0, height: 4, backgroundColor: 'rgba(255,255,255,0.2)', borderBottomLeftRadius: 8, borderBottomRightRadius: 8, zIndex: 15, overflow: 'hidden' },
  progressBarFill: { height: '100%' },
  playOverlay: { ...StyleSheet.absoluteFillObject, justifyContent: 'center', alignItems: 'center', zIndex: 5 },

  addToListTopRight: { position: 'absolute', top: 8, right: 8, zIndex: 20 },
  iconDropShadow: { textShadowColor: 'rgba(0,0,0,0.5)', textShadowOffset: { width: 0, height: 2 }, textShadowRadius: 4 },
  cardGradientBottom: { position: 'absolute', bottom: 0, left: 0, right: 0, padding: 12, paddingTop: 40, justifyContent: 'flex-end', zIndex: 5 },
  cardOverlayTitle: { color: '#ffffff', fontSize: 14, fontWeight: 'bold', textShadowColor: 'rgba(0,0,0,0.8)', textShadowOffset: { width: 0, height: 1 }, textShadowRadius: 3 },

  genresSection: { marginTop: 10, paddingTop: 20, paddingBottom: 20 },
  sectionTitle: { fontSize: SIZES.font, fontWeight: 'bold', textTransform: 'uppercase', letterSpacing: 1, marginLeft: SIZES.padding, marginBottom: 15 },
  
  genrePill: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', paddingHorizontal: 20, paddingVertical: 12, borderRadius: 25, borderWidth: 1, marginRight: CARD_MARGIN },
  genrePillText: { fontSize: 14, fontWeight: 'bold' },
});