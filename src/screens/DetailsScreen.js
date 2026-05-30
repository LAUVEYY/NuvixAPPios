// src/screens/DetailsScreen.js
import React, { useState, useEffect, useContext, useRef } from 'react';
import { 
  View, Text, StyleSheet, ScrollView, Image, TouchableOpacity, 
  ActivityIndicator, useWindowDimensions, FlatList, Share, Platform, Dimensions, Animated, Modal, TextInput, KeyboardAvoidingView, PanResponder
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import { useNavigation, useRoute, useFocusEffect } from '@react-navigation/native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { WebView } from 'react-native-webview'; 
import * as ScreenOrientation from 'expo-screen-orientation';
import AsyncStorage from '@react-native-async-storage/async-storage'; 
import * as ImagePicker from 'expo-image-picker';
import * as ImageManipulator from 'expo-image-manipulator';
import { ThemeContext } from '../context/ThemeContext';
import { LibraryContext } from '../context/LibraryContext'; 
import { AuthContext } from '../context/AuthContext'; 
import { SIZES } from '../constants/theme';

const KeyboardWrapper = Platform.OS === 'ios' ? KeyboardAvoidingView : View;

let YoutubeIframe = null;
if (Platform.OS !== 'web') {
  try { YoutubeIframe = require('react-native-youtube-iframe').default; } 
  catch (e) { console.log("Youtube Iframe not loaded"); }
}

const API_KEY = "55550670b2e9a6b8c3c3c69b0bdf894f";
const BASE_URL = "https://api.themoviedb.org/3";
const IMG_BASE = "https://image.tmdb.org/t/p/";

const watchSources = [
  { name: "Nuvix-Go", movieUrl: "https://gomovies-sx.net/embed/movie/{imdb_id}?autoplay=1", tvUrl: "https://gomovies-sx.net/embed/tv/{imdb_id}/{season}/{episode}?" },
  { name: "Nuvix-Core", movieUrl: "https://vidsrc.cc/v2/embed/movie/{imdb_id}?autoplay=1", tvUrl: "https://vidsrc.cc/v2/embed/tv/{imdb_id}/{season}/{episode}" },
  { name: "Nuvix-Anime", tvUrl: "https://vidsrc.cc/v2/embed/anime/{imdb_id}/{episode}/sub" },
  { name: "Nuvix-Prime", movieUrl: "https://vidsrc-embed.ru/embed/movie?imdb={imdb_id}", tvUrl: "https://vidsrc.xyz/embed/tv?imdb={imdb_id}&season={season}&episode={episode}" },
  { name: "Nuvix-Relay", movieUrl: "https://vidsrcme.su/embed/movie/{imdb_id}", tvUrl: "https://vidsrc.to/embed/tv/{imdb_id}/{season}/{episode}" },
  { name: "Nuvix-Nexus", movieUrl: "https://www.2embed.cc/embed/{imdb_id}", tvUrl: "https://www.2embed.cc/embedtv/{imdb_id}/s-{season}-e-{episode}" },
  { name: "Nuvix-backup", movieUrl: "https://multiembed.mov/?video_id={imdb_id}&tmdb=1", tvUrl: "https://multiembed.mov/?video_id={imdb_id}&s={season}&e={episode}" }
];

const injectedTrackingJS = `
  setInterval(function() {
    try {
      var v = document.querySelector('video') || document.querySelector('iframe').contentWindow.document.querySelector('video');
      if (v && v.duration) {
        window.ReactNativeWebView.postMessage(JSON.stringify({
          type: 'progress', currentTime: v.currentTime, duration: v.duration
        }));
      }
    } catch(e) {}
  }, 10000); true;
`;

const MixtapeCover = ({ mixtape, theme }) => {
  const style = mixtape.coverStyle || 'mosaic';
  const items = mixtape.items || [];
  
  if (style === 'custom' && mixtape.customCoverImage) {
      return <Image source={{ uri: mixtape.customCoverImage }} style={[styles.mixCoverBase, { borderColor: theme.border }]} />;
  }

  if (items.length === 0) {
      return (
          <View style={[styles.mixCoverBase, { backgroundColor: theme.surface, borderColor: theme.border, justifyContent: 'center', alignItems: 'center', flexDirection: 'column', flexWrap: 'nowrap' }]}>
              <Ionicons name="film-outline" size={24} color={theme.textSecondary} />
          </View>
      );
  }

  const getImg = (idx) => `${IMG_BASE}w342${items[idx % items.length].poster_path}`;

  if (style === 'ambient') {
      return (
          <View style={[styles.mixCoverBase, { borderColor: theme.border, overflow: 'hidden' }]}>
              <Image source={{ uri: getImg(0) }} style={{ width: '120%', height: '120%', position: 'absolute', top: '-10%', left: '-10%', resizeMode: 'cover' }} blurRadius={20} />
              <LinearGradient colors={['rgba(255,255,255,0.1)', 'rgba(0,0,0,0.6)']} style={StyleSheet.absoluteFillObject} />
              <Text style={{ color: '#fff', fontWeight: '900', fontSize: 10, textAlign: 'center', alignSelf: 'center', marginTop: 'auto', marginBottom: 'auto', paddingHorizontal: 2 }} numberOfLines={1}>{mixtape.title}</Text>
          </View>
      );
  }

  if (style === 'stack') {
      return (
          <View style={[styles.mixCoverBase, { borderColor: theme.border, backgroundColor: theme.surface, overflow: 'hidden' }]}>
              {items.length >= 3 && <Image source={{ uri: getImg(2) }} style={{ position: 'absolute', width: '80%', height: '80%', top: -5, alignSelf: 'center', opacity: 0.5, borderRadius: 4, resizeMode: 'cover' }} />}
              {items.length >= 2 && <Image source={{ uri: getImg(1) }} style={{ position: 'absolute', width: '90%', height: '90%', top: -2, alignSelf: 'center', opacity: 0.8, borderRadius: 4, resizeMode: 'cover' }} />}
              <Image source={{ uri: getImg(0) }} style={{ width: '100%', height: '100%', borderRadius: 4, resizeMode: 'cover' }} />
              <LinearGradient colors={['transparent', 'rgba(0,0,0,0.8)']} style={StyleSheet.absoluteFillObject} />
          </View>
      );
  }

  if (style === 'single') {
      const singleImg = items[0].backdrop_path || items[0].poster_path;
      return (
          <View style={[styles.mixCoverBase, { borderColor: theme.border, overflow: 'hidden' }]}>
              <Image source={{ uri: `https://image.tmdb.org/t/p/w500${singleImg}` }} style={{ width: '100%', height: '100%', resizeMode: 'cover' }} />
          </View>
      );
  }

  return (
      <View style={[styles.mixCoverBase, { borderColor: theme.border, flexWrap: 'wrap', flexDirection: 'row', overflow: 'hidden' }]}>
          <Image source={{ uri: getImg(0) }} style={{ width: '50%', height: '50%', resizeMode: 'cover' }} />
          <Image source={{ uri: getImg(1) }} style={{ width: '50%', height: '50%', resizeMode: 'cover' }} />
          <Image source={{ uri: getImg(2) }} style={{ width: '50%', height: '50%', resizeMode: 'cover' }} />
          <Image source={{ uri: getImg(3) }} style={{ width: '50%', height: '50%', resizeMode: 'cover' }} />
      </View>
  );
};

export default function DetailsScreen() {
  const { theme, isDarkMode, dataSaver, autoplayTrailers } = useContext(ThemeContext);
  const { activeProfile } = useContext(AuthContext); 
  
  const imgQualityLogo = dataSaver ? 'w342' : 'w500';
  const imgQualityHero = dataSaver ? 'w780' : 'original';
  const imgQualityCast = dataSaver ? 'w92' : 'w185';
  const imgQualityEp = dataSaver ? 'w342' : 'w500';

  const { toggleWatchlist, isInWatchlist, addToHistory, watchlist, history, mixtapes, createMixtape, toggleInMixtape, updateMixtapeStyle, deleteMixtape, leaveCollaborativeMixtape } = useContext(LibraryContext); 
  
  const navigation = useNavigation();
  const route = useRoute();
  const insets = useSafeAreaInsets();
  
  const { width, height } = useWindowDimensions();
  const isTablet = width >= 768; 
  
  const { id, type, autoPlaySeason, autoPlayEpisode } = route.params;
  const scrollViewRef = useRef(null);

  const [details, setDetails] = useState(null);
  const [loading, setLoading] = useState(true);
  
  const [collectionData, setCollectionData] = useState([]);
  const [similarData, setSimilarData] = useState([]);
  const [activeTab, setActiveTab] = useState('similar');

  const [activeMediaUrl, setActiveMediaUrl] = useState(null);
  const [selectedServerIndex, setSelectedServerIndex] = useState(0); 
  
  const [selectedSeason, setSelectedSeason] = useState(autoPlaySeason || 1);
  const [currentPlayingEpisode, setCurrentPlayingEpisode] = useState(autoPlayEpisode || null); 
  
  const [episodes, setEpisodes] = useState([]);
  const [loadingEpisodes, setLoadingEpisodes] = useState(false);
  const [currentCast, setCurrentCast] = useState([]);

  const [progressData, setProgressData] = useState({});
  const progressRef = useRef({});
  const playStartTimeRef = useRef(null);
  const hasSyncedHistoryRef = useRef(false);

  const listIconScale = useRef(new Animated.Value(1)).current;
  const inList = details ? isInWatchlist(details.id) : false;

  const [mixtapeModalVisible, setMixtapeModalVisible] = useState(false);
  const [showNewMixForm, setShowNewMixForm] = useState(false);
  const [newMixtapeName, setNewMixtapeName] = useState('');
  const [newMixtapeDesc, setNewMixtapeDesc] = useState('');
  const [loadingMixId, setLoadingMixId] = useState(null);
  
  const [editMixModalVisible, setEditMixModalVisible] = useState(false);
  const [activeEditMix, setActiveEditMix] = useState(null);
  const [mixTitleEdit, setMixTitleEdit] = useState('');
  const [mixDescEdit, setMixDescEdit] = useState('');

  const [alertConfig, setAlertConfig] = useState({ visible: false, title: '', message: '' });
  const showAlert = (title, message) => setAlertConfig({ visible: true, title, message });

  const panY = useRef(new Animated.Value(0)).current;

  const panResponder = useRef(
      PanResponder.create({
          onStartShouldSetPanResponder: () => true, 
          onMoveShouldSetPanResponder: (_, gestureState) => {
              return gestureState.dy > 5 && Math.abs(gestureState.dy) > Math.abs(gestureState.dx);
          },
          onPanResponderMove: (_, gestureState) => {
              if (gestureState.dy > 0) { panY.setValue(gestureState.dy); }
          },
          onPanResponderRelease: (_, gestureState) => {
              if (gestureState.dy > 120 || gestureState.vy > 1.0) {
                  Animated.timing(panY, {
                      toValue: Dimensions.get('window').height, duration: 250, useNativeDriver: true
                  }).start(() => {
                      setMixtapeModalVisible(false);
                      setEditMixModalVisible(false);
                  });
              } else {
                  Animated.spring(panY, { toValue: 0, useNativeDriver: true, bounciness: 4 }).start();
              }
          }
      })
  ).current;

  useEffect(() => {
      if (mixtapeModalVisible || editMixModalVisible) {
          panY.setValue(0);
      }
  }, [mixtapeModalVisible, editMixModalVisible, panY]);

  useFocusEffect(
    React.useCallback(() => {
      ScreenOrientation.unlockAsync();
      return () => {
        const dim = Dimensions.get('window');
        const tabletCheck = Platform.OS === 'ios' ? Platform.isPad : Math.min(dim.width, dim.height) >= 600;
        if (!tabletCheck && Platform.OS !== 'web') ScreenOrientation.lockAsync(ScreenOrientation.OrientationLock.PORTRAIT_UP);
      };
    }, [])
  );

  useEffect(() => {
    setActiveMediaUrl(null);
    setCurrentPlayingEpisode(autoPlayEpisode || null);
    setSelectedSeason(autoPlaySeason || 1);
    playStartTimeRef.current = null;
  }, [id, autoPlaySeason, autoPlayEpisode]);

  useEffect(() => {
    const loadProgress = async () => {
      try {
        let parsed = {};
        const stored = await AsyncStorage.getItem(`nuvix_prog_${id}`);
        if (stored) parsed = JSON.parse(stored);
        
        if (!hasSyncedHistoryRef.current && history.length > 0) {
            const historyItem = history.find(item => item.id === id);
            if (historyItem) {
                if (historyItem.progressMap) parsed = { ...parsed, ...historyItem.progressMap };
                if (type === 'movie' && historyItem.savedProgress && !parsed['1-1']) {
                    parsed['1-1'] = historyItem.savedProgress;
                }
                AsyncStorage.setItem(`nuvix_prog_${id}`, JSON.stringify(parsed));
                hasSyncedHistoryRef.current = true;
            }
        }
        setProgressData(parsed);
        progressRef.current = parsed;
      } catch (e) { console.log(e); }
    };
    loadProgress();
  }, [id, history.length, type]);

  useEffect(() => {
    if (type === 'tv' && details && !currentPlayingEpisode) {
      const historyItem = history.find(item => item.id === id);
      if (historyItem && historyItem.last_watched_season && historyItem.last_watched_episode) {
        setSelectedSeason(historyItem.last_watched_season);
        setCurrentPlayingEpisode(historyItem.last_watched_episode);
      } else {
        const keys = Object.keys(progressData);
        if (keys.length > 0) {
          const tvKeys = keys.filter(k => k !== '1-1');
          if (tvKeys.length > 0) {
            const lastWatched = tvKeys[tvKeys.length - 1].split('-');
            setSelectedSeason(parseInt(lastWatched[0]));
            setCurrentPlayingEpisode(parseInt(lastWatched[1]));
          }
        }
      }
    }
  }, [details, history, progressData, currentPlayingEpisode, id, type]);

  const calculateAndSaveTime = (epNum) => {
    if (!playStartTimeRef.current) return null;
    const timeSpentMinutes = (Date.now() - playStartTimeRef.current) / 60000;
    let epRuntime = type === 'movie' ? (details?.runtime || 120) : (episodes.find(e => e.episode_number === epNum)?.runtime || 45);
    
    const key = type === 'movie' ? '1-1' : `${selectedSeason}-${epNum}`;
    const currentProg = progressRef.current[key] || 0;
    
    if (currentProg >= 0.95) return currentProg; 
    if (currentProg > 0.06) return currentProg; 
    
    let newProg = currentProg + (timeSpentMinutes / epRuntime);
    if (newProg >= 0.85 || timeSpentMinutes > epRuntime * 0.85) newProg = 1.0;
    newProg = Math.min(newProg, 1.0);
    
    if (newProg > currentProg && newProg > 0.05) { 
        const updated = { ...progressRef.current, [key]: newProg };
        setProgressData(updated);
        progressRef.current = updated;
        AsyncStorage.setItem(`nuvix_prog_${id}`, JSON.stringify(updated));
        return newProg;
    }
    return currentProg;
  };

  const getLiteItem = () => {
    if (!details) return null;
    return {
      id: details.id, title: details.title || details.name || null,
      name: details.name || details.title || null,
      poster_path: details.poster_path || null, backdrop_path: details.backdrop_path || null,
      vote_average: details.vote_average || 0,
      release_date: details.release_date || null, first_air_date: details.first_air_date || null,
      media_type: type, overview: details.overview || ""
    };
  };

  const syncProgressToContext = (epNum, progValue) => {
    if (!details) return;
    const exactEpisode = type === 'tv' ? episodes.find(e => e.episode_number === epNum) : null;
    const liteItem = {
      ...getLiteItem(),
      episode_still_path: exactEpisode?.still_path || null,
      last_watched_season: type === 'tv' ? selectedSeason : null,
      last_watched_episode: type === 'tv' ? epNum : null,
      savedProgress: progValue, progressMap: progressRef.current 
    };
    addToHistory(liteItem);
  };

  const trackingRef = useRef({ calculateAndSaveTime, syncProgressToContext, currentPlayingEpisode });
  useEffect(() => { trackingRef.current = { calculateAndSaveTime, syncProgressToContext, currentPlayingEpisode }; });

  useEffect(() => {
    const unsubscribe = navigation.addListener('beforeRemove', () => {
      if (playStartTimeRef.current) {
          const { calculateAndSaveTime: calc, syncProgressToContext: sync, currentPlayingEpisode: ep } = trackingRef.current;
          const finalProg = calc(ep || 1);
          if (finalProg !== null) sync(ep || 1, finalProg);
      }
    });
    return unsubscribe;
  }, [navigation]);

  useEffect(() => {
    const fetchDetails = async () => {
      try {
        const res = await fetch(`${BASE_URL}/${type}/${id}?api_key=${API_KEY}&append_to_response=credits,recommendations,images,external_ids,videos&include_image_language=en,null`);
        const data = await res.json();
        
        data.media_type = type;
        setDetails(data);
        setCurrentCast(data.credits?.cast || []);

        let colParts = [];
        if (type === 'movie' && data.belongs_to_collection) {
          const colRes = await fetch(`${BASE_URL}/collection/${data.belongs_to_collection.id}?api_key=${API_KEY}`);
          const colData = await colRes.json();
          if (colData.parts) {
            colParts = colData.parts.sort((a, b) => new Date(a.release_date) - new Date(b.release_date)).filter(p => p.id !== id);
            setCollectionData(colParts);
            if (colParts.length > 0) setActiveTab('collection');
          }
        }

        const collectionIds = new Set(colParts.map(p => p.id));
        const filteredRecs = (data.recommendations?.results || []).filter(rec => !collectionIds.has(rec.id));
        setSimilarData(filteredRecs);

        if (type === 'tv') {
          const targetSeason = autoPlaySeason || data.seasons?.find(s => s.season_number > 0)?.season_number || 1;
          setSelectedSeason(targetSeason);
          fetchSeason(targetSeason, data); 
        }
      } catch (error) { console.error("Error fetching details:", error); } 
      finally { setLoading(false); }
    };
    fetchDetails();
  }, [id, type]);

  const fetchSeason = async (seasonNumber, fallbackDetails = null) => {
    setLoadingEpisodes(true);
    try {
      const res = await fetch(`${BASE_URL}/tv/${id}/season/${seasonNumber}?api_key=${API_KEY}&append_to_response=credits`);
      const data = await res.json();
      setEpisodes(data.episodes || []);
      const sourceDetails = fallbackDetails || details;
      if (data.credits && data.credits.cast && data.credits.cast.length > 0) setCurrentCast(data.credits.cast);
      else if (sourceDetails && sourceDetails.credits?.cast) setCurrentCast(sourceDetails.credits.cast);
    } catch (error) { console.error("Error fetching season:", error); } 
    finally { setLoadingEpisodes(false); }
  };

  const handleSeasonChange = (seasonNum) => {
    setSelectedSeason(seasonNum);
    fetchSeason(seasonNum);
  };

  const handlePlay = (episodeNumber = null, targetServer = selectedServerIndex) => {
    const epToPlay = episodeNumber || currentPlayingEpisode || 1;
    if (currentPlayingEpisode && currentPlayingEpisode !== epToPlay) {
      const finalProg = calculateAndSaveTime(currentPlayingEpisode);
      if (finalProg !== null) syncProgressToContext(currentPlayingEpisode, finalProg);
    }

    setCurrentPlayingEpisode(epToPlay);
    playStartTimeRef.current = Date.now(); 

    const key = type === 'movie' ? '1-1' : `${selectedSeason}-${epToPlay}`;
    const initialProg = progressRef.current[key] || 0; 
    progressRef.current[key] = initialProg;
    setProgressData({ ...progressRef.current });
    syncProgressToContext(epToPlay, initialProg);

    const targetId = details?.external_ids?.imdb_id || id; 
    const source = watchSources[targetServer];
    let url = '';

    if (type === 'movie') {
      if (!source.movieUrl) { showAlert("Server Error", "This server does not support movies."); return; }
      url = source.movieUrl.replace('{imdb_id}', targetId);
    } else {
      if (!source.tvUrl) { showAlert("Server Error", "This server does not support TV shows."); return; }
      url = source.tvUrl.replace('{imdb_id}', targetId).replace('{season}', selectedSeason).replace('{episode}', epToPlay);
    }

    setActiveMediaUrl(url.includes('?') ? `${url}&t=${new Date().getTime()}` : `${url}?t=${new Date().getTime()}`);
    setTimeout(() => { scrollViewRef.current?.scrollTo({ y: 0, animated: true }); }, 100);
  };

  const handleServerSelect = (index) => {
    setSelectedServerIndex(index);
    if (activeMediaUrl && !activeMediaUrl.startsWith('youtube:')) handlePlay(currentPlayingEpisode, index);
  };

  const handlePlayTrailer = () => {
    const videos = details?.videos?.results || [];
    const trailer = videos.find(v => v.type === 'Trailer' && v.site === 'YouTube') || videos.find(v => v.site === 'YouTube');
    if (trailer) {
      setActiveMediaUrl(`youtube:${trailer.key}`);
      setCurrentPlayingEpisode(null);
      playStartTimeRef.current = null;
      setTimeout(() => { scrollViewRef.current?.scrollTo({ y: 0, animated: true }); }, 100);
    } else {
      showAlert("No Trailer", "A trailer is not available for this title.");
    }
  };

  const handleToggleList = () => {
    Animated.sequence([
      Animated.timing(listIconScale, { toValue: 1.4, duration: 100, useNativeDriver: true }),
      Animated.spring(listIconScale, { toValue: 1, friction: 4, tension: 60, useNativeDriver: true })
    ]).start();
    toggleWatchlist(getLiteItem());
  };

  const handleCreateMixtape = () => {
      if (newMixtapeName.trim()) {
          createMixtape(newMixtapeName, newMixtapeDesc);
          setNewMixtapeName('');
          setNewMixtapeDesc('');
          setShowNewMixForm(false);
      }
  };

  const handleToggleInMixtape = async (mixId) => {
      if (loadingMixId) return; // prevent double-tap while another is in flight
      setLoadingMixId(mixId);
      try {
          await toggleInMixtape(mixId, getLiteItem());
      } finally {
          setLoadingMixId(null);
      }
  };

  const openMixEditor = (mix) => {
      setActiveEditMix(mix);
      setMixTitleEdit(mix.title);
      setMixDescEdit(mix.description || '');
      setEditMixModalVisible(true);
  };

  const saveMixEdit = () => {
      if (mixTitleEdit.trim()) {
          updateMixtapeStyle(activeEditMix.id, activeEditMix.coverStyle, activeEditMix.customCoverImage, mixTitleEdit.trim(), mixDescEdit.trim());
      }
      setEditMixModalVisible(false);
  };

  const processImage = async (uri) => {
      if (Platform.OS === 'web') {
          return new Promise((resolve, reject) => {
              const img = new window.Image();
              img.crossOrigin = 'Anonymous';
              img.onload = () => {
                  const canvas = document.createElement('canvas');
                  const MAX_DIM = 600; 
                  let w = img.width; let h = img.height;
                  const size = Math.min(w, h);
                  const x = (w - size) / 2; const y = (h - size) / 2;
                  canvas.width = MAX_DIM; canvas.height = MAX_DIM;
                  const ctx = canvas.getContext('2d');
                  ctx.drawImage(img, x, y, size, size, 0, 0, MAX_DIM, MAX_DIM);
                  resolve(canvas.toDataURL('image/jpeg', 0.3));
              };
              img.onerror = reject;
              img.src = uri;
          });
      } else {
          const manipResult = await ImageManipulator.manipulateAsync(
              uri, [{ resize: { width: 600, height: 600 } }], 
              { compress: 0.5, format: ImageManipulator.SaveFormat.JPEG, base64: true } 
          );
          return `data:image/jpeg;base64,${manipResult.base64}`;
      }
  };

  const handlePickMixImage = async () => {
    try {
      let result = await ImagePicker.launchImageLibraryAsync({ mediaTypes: ['images'], allowsEditing: true, aspect: [1, 1], quality: 0.8 });
      if (!result.canceled && result.assets && result.assets.length > 0) {
        const processed = await processImage(result.assets[0].uri);
        await updateMixtapeStyle(activeEditMix.id, 'custom', processed);
        setActiveEditMix({...activeEditMix, coverStyle: 'custom', customCoverImage: processed});
      }
    } catch (e) { console.error("Mix Image pick error", e); }
  };

  const handleShare = async () => {
    if (!details) return;
    const title = details.title || details.name || 'this title';
    const shareUrl = `https://nuvix.fun/${type}/${id}`;
    try { 
      if (Platform.OS === 'web') {
        if (navigator && navigator.share) await navigator.share({ title: `Check out ${title}`, text: `Watch ${title} right now on Nuvix!`, url: shareUrl });
        else if (navigator && navigator.clipboard) {
          await navigator.clipboard.writeText(shareUrl);
          showAlert("Link Copied!", "The share link has been copied to your clipboard.");
        }
      } else {
        await Share.share({ message: `Watch ${title} right now on Nuvix!\n\n${shareUrl}`, url: shareUrl, title: `Check out ${title}` }); 
      }
    } catch (error) { console.log("Share action cancelled or failed:", error); }
  };

  const handleUniversalClose = () => {
    if (currentPlayingEpisode || type === 'movie') {
        const finalProg = calculateAndSaveTime(currentPlayingEpisode || 1);
        if (finalProg !== null) syncProgressToContext(currentPlayingEpisode || 1, finalProg);
    }
    setActiveMediaUrl(null);
    playStartTimeRef.current = null;
    navigation.popToTop(); 
  };

  const handleFullscreenUpdate = async (event) => {
    if (!isTablet && Platform.OS !== 'web') {
      if (event.nativeEvent.state === 1) await ScreenOrientation.unlockAsync(); 
      else if (event.nativeEvent.state === 3) await ScreenOrientation.lockAsync(ScreenOrientation.OrientationLock.PORTRAIT_UP);
    }
  };

  const handleWebViewMessage = (event) => {
    try {
      const data = JSON.parse(event.nativeEvent.data);
      if (data.type === 'progress' && data.duration > 0 && (currentPlayingEpisode || type === 'movie')) {
         let percentage = data.currentTime / data.duration;
         setProgressData(prev => {
            const key = type === 'movie' ? '1-1' : `${selectedSeason}-${currentPlayingEpisode || 1}`;
            const currentProg = prev[key] || 0;
            if (currentProg >= 0.95) return prev; 
            if (percentage >= 0.85) percentage = 1.0;
            if (percentage > currentProg) {
                const updated = { ...prev, [key]: percentage };
                progressRef.current = updated;
                AsyncStorage.setItem(`nuvix_prog_${id}`, JSON.stringify(updated));
                return updated;
            }
            return prev;
         });
      }
    } catch(e) {}
  };

  if (loading || !details) {
    return (
      <View style={[styles.centered, { backgroundColor: theme.background }]}>
        <ActivityIndicator size="large" color={theme.primary} />
      </View>
    );
  }

  const logoObj = details.images?.logos?.find(l => l.iso_639_1 === 'en') || details.images?.logos?.[0];
  const releaseYear = (details.release_date || details.first_air_date || '').substring(0, 4);
  const duration = type === 'movie' ? `${Math.floor(details.runtime / 60)}h ${details.runtime % 60}m` : `${details.number_of_seasons} Season${details.number_of_seasons > 1 ? 's' : ''}`;

  const gradientMiddle = isDarkMode ? 'rgba(0,0,0,0.6)' : 'rgba(255,255,255,0.6)';
  
  const hasCollection = collectionData && collectionData.length > 0;
  const hasSimilar = similarData && similarData.length > 0;
  const activeCarouselData = activeTab === 'collection' ? collectionData : similarData;
  
  const videoHeight = activeMediaUrl ? (isTablet ? (height * 0.6) : 300) : (isTablet ? 650 : 500);
  const isYouTube = activeMediaUrl?.startsWith('youtube:');
  const youtubeId = isYouTube ? activeMediaUrl.split(':')[1] : null;

  const movieProg = progressData['1-1'] || 0;
  const movieFinished = movieProg >= 0.95;
  const moviePartial = movieProg > 0.05 && movieProg < 0.95; 

  const isInAnyMixtape = mixtapes.some(mix => mix.items.some(i => i.id === details.id));

  let mainPlayText = 'Play';
  if (type === 'movie') {
      mainPlayText = movieFinished ? 'Play Again' : moviePartial ? 'Continue Watching' : 'Play';
  } else {
      const epToDisplay = currentPlayingEpisode || 1;
      const epProg = progressData[`${selectedSeason}-${epToDisplay}`] || 0;
      if (epProg >= 0.95) mainPlayText = `Play S${selectedSeason} E${epToDisplay} Again`;
      else if (epProg > 0.05) mainPlayText = `Continue Watching S${selectedSeason} E${epToDisplay}`;
      else mainPlayText = `Play S${selectedSeason} E${epToDisplay}`;
  }

  return (
    <View style={[styles.container, { backgroundColor: theme.background }]}>
      <ScrollView ref={scrollViewRef} bounces={false} showsVerticalScrollIndicator={false}>
        
        <View style={{ width: '100%', height: videoHeight, marginTop: activeMediaUrl ? insets.top : 0, backgroundColor: '#000', position: 'relative' }}>
          <TouchableOpacity style={[styles.backButton, { top: activeMediaUrl ? 10 : Math.max(insets.top, 20) }]} onPress={handleUniversalClose}>
            <Ionicons name="close" size={28} color="#fff" style={styles.iconDropShadow} />
          </TouchableOpacity>

          {activeMediaUrl ? (
            Platform.OS === 'web' ? (
              React.createElement('iframe', {
                src: isYouTube ? `https://www.youtube.com/embed/${youtubeId}?autoplay=${autoplayTrailers ? 1 : 0}&rel=0&playsinline=1&controls=1&modestbranding=1&vq=${dataSaver ? 'large' : 'hd1080'}` : activeMediaUrl,
                style: { width: '100%', height: '100%', border: 'none', backgroundColor: '#000' },
                allowFullScreen: true, allow: autoplayTrailers ? "autoplay; fullscreen" : "fullscreen"
              })
            ) : (
              isYouTube && YoutubeIframe ? (
                <View style={{ flex: 1, backgroundColor: '#000', justifyContent: 'center' }}>
                  <YoutubeIframe height={videoHeight} width={'100%'} play={autoplayTrailers} videoId={youtubeId} initialPlayerParams={{ preventFullScreen: false, rel: 0, modestbranding: 1, vq: dataSaver ? 'large' : 'hd1080' }} />
                </View>
              ) : (
                <WebView source={{ uri: activeMediaUrl }} style={{ flex: 1, backgroundColor: '#000' }} allowsFullscreenVideo={true} allowsInlineMediaPlayback={true} mediaPlaybackRequiresUserAction={false} javaScriptEnabled={true} domStorageEnabled={true} injectedJavaScript={injectedTrackingJS} onMessage={handleWebViewMessage} onFullscreenUpdate={handleFullscreenUpdate} />
              )
            )
          ) : (
            <>
              <Image source={{ uri: `${IMG_BASE}${imgQualityHero}${details.backdrop_path || details.poster_path}` }} style={styles.heroImage} />
              <LinearGradient colors={['transparent', gradientMiddle, theme.background]} style={styles.heroGradientBottom} />
            </>
          )}
        </View>

        <View style={[styles.contentContainer, activeMediaUrl && { marginTop: 20 }, isTablet && styles.tabletContentContainer]}>
          
          {!activeMediaUrl && (logoObj ? (
            <Image source={{ uri: `${IMG_BASE}${imgQualityLogo}${logoObj.file_path}` }} style={styles.logo} resizeMode="contain" />
          ) : (
            <Text style={[styles.title, { color: theme.text }]}>{details.title || details.name}</Text>
          ))}

          <View style={styles.metaRow}>
            <Text style={[styles.metaText, { color: theme.primary, fontWeight: 'bold' }]}>{Math.round(details.vote_average * 10)}% Match</Text>
            <Text style={[styles.metaText, { color: theme.textSecondary }]}>{releaseYear}</Text>
            <View style={[styles.metaBadge, { borderColor: theme.textSecondary }]}>
              <Text style={[styles.metaBadgeText, { color: theme.textSecondary }]}>4K</Text>
            </View>
            <Text style={[styles.metaText, { color: theme.textSecondary }]}>{duration}</Text>
          </View>

          <View style={[styles.mainActionRow, isTablet && { maxWidth: 500 }]}>
            <TouchableOpacity style={[styles.playButton, { backgroundColor: theme.text }]} onPress={() => handlePlay()}>
              <Ionicons name={movieFinished && type === 'movie' ? "refresh" : "play"} size={20} color={theme.background} />
              <Text style={[styles.playButtonText, { color: theme.background }]}>{mainPlayText}</Text>
            </TouchableOpacity>

            <TouchableOpacity style={[styles.actionBtnGlass, { backgroundColor: theme.surfaceGlass, borderColor: theme.border }]} onPress={handlePlayTrailer}>
              <Ionicons name="videocam-outline" size={20} color={theme.text} />
              <Text style={[styles.actionBtnText, { color: theme.text }]}>Trailer</Text>
            </TouchableOpacity>
          </View>

          <View style={[styles.serverSection, isTablet && { maxWidth: 700 }]}>
            <Text style={[styles.serverTitle, { color: theme.textSecondary }]}>Streaming Source</Text>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} style={[styles.serverScroll, { backgroundColor: theme.surfaceGlass, borderColor: theme.border }]} contentContainerStyle={{ padding: 4 }}>
              {watchSources.map((server, index) => {
                const isActive = selectedServerIndex === index;
                return (
                  <TouchableOpacity key={index} onPress={() => handleServerSelect(index)} activeOpacity={0.8} style={[styles.serverItem, isActive && { backgroundColor: theme.primary }]}>
                    {isActive && <Ionicons name="play" size={12} color="#fff" style={{ marginRight: 6 }} />}
                    <Text style={[styles.serverItemText, { color: isActive ? '#fff' : theme.textSecondary }]}>{server.name}</Text>
                  </TouchableOpacity>
                );
              })}
            </ScrollView>
          </View>

          <Text style={[styles.overview, { color: theme.text }]} numberOfLines={isTablet ? 10 : 5}>{details.overview}</Text>

          <View style={styles.iconActionRow}>
            <TouchableOpacity style={styles.iconActionItem} onPress={handleToggleList} activeOpacity={0.7}>
              <Animated.View style={{ transform: [{ scale: listIconScale }] }}>
                <Ionicons name={inList ? "checkmark-outline" : "add-outline"} size={28} color={theme.text} />
              </Animated.View>
              <Text style={[styles.iconActionText, { color: theme.textSecondary }]}>My List</Text>
            </TouchableOpacity>
            
            <TouchableOpacity style={styles.iconActionItem} onPress={() => setMixtapeModalVisible(true)} activeOpacity={0.7}>
              <Ionicons name={isInAnyMixtape ? "albums" : "albums-outline"} size={28} color={isInAnyMixtape ? theme.primary : theme.text} />
              <Text style={[styles.iconActionText, { color: theme.textSecondary }]}>Mixtape</Text>
            </TouchableOpacity>

            <TouchableOpacity style={styles.iconActionItem} onPress={handleShare} activeOpacity={0.7}>
              <Ionicons name="paper-plane-outline" size={28} color={theme.text} />
              <Text style={[styles.iconActionText, { color: theme.textSecondary }]}>Share</Text>
            </TouchableOpacity>
          </View>

          {currentCast.length > 0 && (
            <View style={styles.section}>
              <Text style={[styles.sectionTitle, { color: theme.text }]}>Top Cast</Text>
              <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ paddingVertical: 10 }}>
                {currentCast.slice(0, 10).map((actor) => (
                  <TouchableOpacity key={actor.id} style={styles.castItem} activeOpacity={0.7} onPress={() => navigation.navigate('MainTabs', { screen: 'Search', params: { query: actor.name } })}>
                    <Image source={{ uri: actor.profile_path ? `${IMG_BASE}${imgQualityCast}${actor.profile_path}` : 'https://via.placeholder.com/150' }} style={styles.castImage} />
                    <Text style={[styles.castName, { color: theme.text }]} numberOfLines={2}>{actor.name}</Text>
                  </TouchableOpacity>
                ))}
              </ScrollView>
            </View>
          )}

          {type === 'tv' && details.seasons?.length > 0 && (
            <View style={styles.section}>
              <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.seasonScrollOuter}>
                {details.seasons.filter(s => s.season_number > 0).map((season) => (
                  <TouchableOpacity key={season.id} style={[styles.seasonPill, selectedSeason === season.season_number ? { backgroundColor: theme.text, borderColor: theme.text } : { borderColor: theme.border, backgroundColor: theme.surfaceGlass }]} onPress={() => handleSeasonChange(season.season_number)}>
                    <Text style={[styles.seasonPillText, { color: selectedSeason === season.season_number ? theme.background : theme.textSecondary }]}>{season.name}</Text>
                  </TouchableOpacity>
                ))}
              </ScrollView>

              {loadingEpisodes ? (
                <ActivityIndicator size="small" color={theme.primary} style={{ marginTop: 20 }} />
              ) : (
                <ScrollView style={{ maxHeight: 540 }} nestedScrollEnabled={true} showsVerticalScrollIndicator={true}>
                  {episodes.map((ep) => {
                    const prog = progressData[`${selectedSeason}-${ep.episode_number}`] || 0;
                    const isFullyWatched = prog >= 0.95;
                    const isPartiallyWatched = prog > 0.05 && prog < 0.95;

                    return (
                      <TouchableOpacity 
                        key={ep.id} 
                        style={[styles.episodeCard, { borderColor: theme.border, backgroundColor: theme.surfaceGlass, opacity: isFullyWatched ? 0.75 : 1 }]} 
                        onPress={() => handlePlay(ep.episode_number)}
                      >
                        <View style={styles.episodeImageContainer}>
                          <Image source={{ uri: ep.still_path ? `${IMG_BASE}${imgQualityEp}${ep.still_path}` : `${IMG_BASE}${imgQualityEp}${details.backdrop_path}` }} style={styles.episodeImage} />
                          
                          {isFullyWatched && <View style={styles.watchedOverlay} />}
                          
                          {isFullyWatched && (
                            <View style={[styles.watchedBadge, { backgroundColor: theme.primary }]}>
                              <Ionicons name="checkmark" size={9} color="#fff" />
                              <Text style={styles.watchedBadgeText}>WATCHED</Text>
                            </View>
                          )}

                          {(isPartiallyWatched || isFullyWatched) && (
                             <View style={styles.progressBarBg}>
                               <View style={[styles.progressBarFill, { width: `${prog * 100}%`, backgroundColor: theme.primary }]} />
                             </View>
                          )}
                        </View>
                        
                        <View style={styles.episodeInfo}>
                          <Text style={[styles.episodeTitle, { color: isFullyWatched ? theme.textSecondary : theme.text }]} numberOfLines={1}>
                            {ep.episode_number}. {ep.name}
                          </Text>
                          <Text style={[styles.episodeDuration, { color: theme.textSecondary }]}>{ep.runtime ? `${ep.runtime}m` : ''}</Text>
                          <Text style={[styles.episodeOverview, { color: theme.textSecondary }]} numberOfLines={2}>{ep.overview || "No description available."}</Text>
                        </View>
                        
                        <Ionicons name="play-circle-outline" size={32} color={isFullyWatched ? theme.textSecondary : theme.text} style={{ opacity: 0.7 }} />
                      </TouchableOpacity>
                    );
                  })}
                </ScrollView>
              )}
            </View>
          )}
        </View>

        {(hasCollection || hasSimilar) && (
          <View style={[styles.section, { marginTop: 30, marginBottom: 40, paddingHorizontal: isTablet ? '10%' : SIZES.padding }]}>
            <View style={styles.tabRow}>
              {hasCollection && (
                <TouchableOpacity onPress={() => setActiveTab('collection')} style={[styles.tabButton, activeTab === 'collection' && { borderBottomColor: theme.primary, borderBottomWidth: 3 }]}>
                  <Ionicons name="albums-outline" size={18} color={activeTab === 'collection' ? theme.text : theme.textSecondary} style={{ marginRight: 6 }} />
                  <Text style={[styles.tabText, { color: activeTab === 'collection' ? theme.text : theme.textSecondary }]}>Collection</Text>
                </TouchableOpacity>
              )}
              {hasSimilar && (
                <TouchableOpacity onPress={() => setActiveTab('similar')} style={[styles.tabButton, activeTab === 'similar' && { borderBottomColor: theme.primary, borderBottomWidth: 3 }]}>
                  <Ionicons name="grid-outline" size={18} color={activeTab === 'similar' ? theme.text : theme.textSecondary} style={{ marginRight: 6 }} />
                  <Text style={[styles.tabText, { color: activeTab === 'similar' ? theme.text : theme.textSecondary }]}>More Like This</Text>
                </TouchableOpacity>
              )}
            </View>

            {activeCarouselData.length > 0 ? (
              <FlatList
                horizontal showsHorizontalScrollIndicator={false} data={activeCarouselData} keyExtractor={(item) => item.id.toString()} snapToInterval={145} snapToAlignment="start" decelerationRate="fast" contentContainerStyle={{ paddingRight: SIZES.padding }}
                renderItem={({ item }) => (
                  <TouchableOpacity style={styles.carouselCard} activeOpacity={0.9} onPress={() => navigation.push('Details', { id: item.id, type: item.media_type || type })}>
                    <Image source={{ uri: `${IMG_BASE}${imgQualityEp}${item.poster_path}` }} style={[styles.carouselImage, { borderColor: theme.border }]} />
                  </TouchableOpacity>
                )}
              />
            ) : (
              <Text style={{ color: theme.textSecondary, fontStyle: 'italic' }}>No additional titles found.</Text>
            )}
          </View>
        )}
      </ScrollView>

      <Modal visible={mixtapeModalVisible} transparent animationType="slide">
        <KeyboardWrapper behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={isTablet ? styles.desktopModalOverlay : styles.bottomSheetOverlay}>
          <TouchableOpacity style={StyleSheet.absoluteFill} activeOpacity={1} onPress={() => setMixtapeModalVisible(false)} />
          <Animated.View style={[isTablet ? styles.desktopModalContainer : styles.bottomSheetContainer, { backgroundColor: theme.background, borderColor: theme.border }, !isTablet && { transform: [{ translateY: panY }] }]}>
            
            <View {...(!isTablet ? panResponder.panHandlers : {})} style={{ backgroundColor: 'transparent', paddingTop: 10, paddingBottom: 10 }}>
                {!isTablet && <View style={styles.bottomSheetHandle} />}
                <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 }}>
                    <Text style={[styles.bottomSheetTitle, { color: theme.text, marginBottom: 0 }]}>Add to Mixtape</Text>
                    {isTablet && (<TouchableOpacity onPress={() => setMixtapeModalVisible(false)} hitSlop={{top:10, bottom:10, left:10, right:10}}><Ionicons name="close-circle" size={28} color={theme.textSecondary} /></TouchableOpacity>)}
                </View>
            </View>

            {showNewMixForm ? (
                <View style={[styles.newMixForm, { backgroundColor: theme.surfaceGlass, borderColor: theme.border }]}>
                    <Text style={{color: theme.textSecondary, fontSize: 12, fontWeight: 'bold', marginBottom: 5}}>CREATE NEW</Text>
                    <TextInput style={[styles.mixInput, { backgroundColor: theme.background, color: theme.text, borderColor: theme.border }]} placeholder="Mixtape Title" placeholderTextColor={theme.textSecondary} value={newMixtapeName} onChangeText={setNewMixtapeName} />
                    <TextInput style={[styles.mixInputDesc, { backgroundColor: theme.background, color: theme.text, borderColor: theme.border }]} placeholder="Description (Optional)" placeholderTextColor={theme.textSecondary} value={newMixtapeDesc} onChangeText={setNewMixtapeDesc} multiline />
                    <View style={{flexDirection: 'row', gap: 10, marginTop: 10}}>
                        <TouchableOpacity style={[styles.actionBtn, {backgroundColor: theme.surface}]} onPress={() => setShowNewMixForm(false)}><Text style={{color: theme.text, fontWeight: 'bold'}}>Cancel</Text></TouchableOpacity>
                        <TouchableOpacity style={[styles.actionBtn, {backgroundColor: newMixtapeName.trim() ? theme.primary : theme.surface}]} disabled={!newMixtapeName.trim()} onPress={handleCreateMixtape}><Text style={{color: newMixtapeName.trim() ? '#fff' : theme.textSecondary, fontWeight: 'bold'}}>Create</Text></TouchableOpacity>
                    </View>
                </View>
            ) : (
                <TouchableOpacity style={[styles.createNewMixBtn, { borderColor: theme.border, backgroundColor: theme.surfaceGlass }]} onPress={() => setShowNewMixForm(true)}>
                    <Ionicons name="add-circle" size={24} color={theme.text} />
                    <Text style={{color: theme.text, marginLeft: 10, fontSize: 16, fontWeight: 'bold'}}>Create New Mixtape</Text>
                </TouchableOpacity>
            )}

            <ScrollView style={{maxHeight: isTablet ? 500 : 350, marginTop: 15}} showsVerticalScrollIndicator={false}>
               {mixtapes.map((mix) => {
                 const isItemInMix = mix.items.some(i => i.id === details?.id);
                 const isThisLoading = loadingMixId === mix.id;
                 return (
                   <View key={mix.id} style={[styles.mixtapeRowCard, { backgroundColor: theme.surfaceGlass, borderColor: theme.border }]}>
                     <TouchableOpacity
                       style={{ flexDirection: 'row', alignItems: 'center', flex: 1 }}
                       onPress={() => handleToggleInMixtape(mix.id)}
                       disabled={!!loadingMixId}
                       activeOpacity={0.7}
                     >
                       <View style={[
                         styles.mixtapeCircleCheck,
                         {
                           borderColor: isThisLoading ? theme.primary : isItemInMix ? theme.primary : theme.textSecondary,
                           backgroundColor: isItemInMix && !isThisLoading ? theme.primary : 'transparent'
                         }
                       ]}>
                         {isThisLoading
                           ? <ActivityIndicator size="small" color={theme.primary} />
                           : isItemInMix
                             ? <Ionicons name="checkmark" size={16} color="#fff" />
                             : null
                         }
                       </View>
                       <View style={{ width: 50, height: 50, marginRight: 15 }}><MixtapeCover mixtape={mix} theme={theme} /></View>
                       <View style={{flex: 1, justifyContent: 'center'}}>
                          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: 4 }}>
                             <Text style={[styles.mixtapeRowTitle, { color: theme.text, flexShrink: 1 }]} numberOfLines={1}>{mix.title}</Text>
                             {mix.isCollaborative && (
                                 <View style={[styles.livePillSmall, { borderColor: 'rgba(106, 231, 14, 0.4)', backgroundColor: 'rgba(106, 231, 14, 0.1)' }]}>
                                     <Ionicons name="people" size={10} color="#6ae70e" />
                                     <Text style={[styles.livePillTextSmall, { color: '#6ae70e' }]}>GROUP</Text>
                                 </View>
                             )}
                          </View>
                          <Text style={[styles.mixtapeRowSubtitle, { color: theme.textSecondary }]} numberOfLines={1}>
                              {mix.items.length} items • {mix.ownerName || mix.originalOwner || activeProfile?.name || 'My Profile'}
                          </Text>
                       </View>
                     </TouchableOpacity>
                     <View style={{ flexDirection: 'row', alignItems: 'center', gap: 15, marginLeft: 10 }}>
                         <TouchableOpacity onPress={() => { setMixtapeModalVisible(false); navigation.navigate('MainTabs', { screen: 'Library', params: { viewMixtapeId: mix.id } }); }} hitSlop={{top: 15, bottom: 15, left: 10, right: 10}}>
                            <Ionicons name="eye-outline" size={24} color={theme.textSecondary} />
                         </TouchableOpacity>
                         <TouchableOpacity onPress={() => openMixEditor(mix)} hitSlop={{top: 15, bottom: 15, left: 10, right: 10}}>
                            <Ionicons name="pencil-outline" size={22} color={theme.textSecondary} />
                         </TouchableOpacity>
                     </View>
                   </View>
                 );
               })}
               {mixtapes.length === 0 && !showNewMixForm && (<Text style={{color: theme.textSecondary, textAlign: 'center', marginTop: 30, fontStyle: 'italic'}}>No mixtapes created yet.</Text>)}
            </ScrollView>
          </Animated.View>
        </KeyboardWrapper>
      </Modal>

      {/* EDIT MIXTAPE MODAL WITH SAFE LEAVE LOGIC */}
      <Modal visible={editMixModalVisible} transparent animationType="slide">
        <KeyboardWrapper behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={isTablet ? styles.desktopModalOverlay : styles.bottomSheetOverlay}>
           <TouchableOpacity style={StyleSheet.absoluteFill} activeOpacity={1} onPress={() => setEditMixModalVisible(false)} />
           <Animated.View style={[isTablet ? styles.desktopModalContainer : styles.bottomSheetContainer, { backgroundColor: theme.background, borderColor: theme.border }, !isTablet && { transform: [{ translateY: panY }] }]}>
             
             <View {...(!isTablet ? panResponder.panHandlers : {})} style={{ backgroundColor: 'transparent', paddingTop: 10, paddingBottom: 10 }}>
                 {!isTablet && <View style={styles.bottomSheetHandle} />}
                 <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 }}>
                     <Text style={[styles.bottomSheetTitle, { color: theme.text, marginBottom: 0 }]}>Edit Mixtape</Text>
                     {isTablet && (<TouchableOpacity onPress={() => setEditMixModalVisible(false)} hitSlop={{top:10, bottom:10, left:10, right:10}}><Ionicons name="close-circle" size={28} color={theme.textSecondary} /></TouchableOpacity>)}
                 </View>
             </View>

             {activeEditMix && (() => {
                 const isCollaboratorOnly = activeEditMix.isImported && activeEditMix.isCollaborative;
                 return (
                   <ScrollView showsVerticalScrollIndicator={false}>
                     <View style={{ alignItems: 'center', marginBottom: 25 }}><View style={{ width: 140, height: 140 }}><MixtapeCover mixtape={activeEditMix} theme={theme} /></View></View>
                     <Text style={[styles.inputLabel, { color: theme.textSecondary }]}>RENAME MIXTAPE</Text>
                     <TextInput style={[styles.mixInput, { backgroundColor: theme.surface, color: theme.text, borderColor: theme.border, marginBottom: 15 }]} value={mixTitleEdit} onChangeText={setMixTitleEdit} />
                     <Text style={[styles.inputLabel, { color: theme.textSecondary }]}>DESCRIPTION (OPTIONAL)</Text>
                     <TextInput style={[styles.mixInputDesc, { backgroundColor: theme.surface, color: theme.text, borderColor: theme.border, marginBottom: 20 }]} value={mixDescEdit} onChangeText={setMixDescEdit} multiline />
                     <Text style={[styles.inputLabel, { color: theme.textSecondary }]}>COVER STYLE</Text>
                     <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 10, marginBottom: 30 }}>
                        {['mosaic', 'stack', 'ambient', 'single'].map(style => (
                            <TouchableOpacity key={style} onPress={() => { updateMixtapeStyle(activeEditMix.id, style); setActiveEditMix({...activeEditMix, coverStyle: style}); }} style={[styles.stylePill, { backgroundColor: activeEditMix.coverStyle === style ? theme.primary : theme.surfaceGlass, borderColor: theme.border }]}>
                               <Text style={{ color: activeEditMix.coverStyle === style ? '#fff' : theme.text, fontWeight: 'bold', textTransform: 'capitalize' }}>{style}</Text>
                            </TouchableOpacity>
                        ))}
                        <TouchableOpacity onPress={handlePickMixImage} style={[styles.stylePill, { backgroundColor: activeEditMix.coverStyle === 'custom' ? theme.primary : theme.surfaceGlass, borderColor: theme.border }]}>
                           <Ionicons name="image" size={16} color={activeEditMix.coverStyle === 'custom' ? '#fff' : theme.text} style={{marginRight: 5}}/>
                           <Text style={{ color: activeEditMix.coverStyle === 'custom' ? '#fff' : theme.text, fontWeight: 'bold' }}>Custom Photo</Text>
                        </TouchableOpacity>
                     </View>
                     <View style={{ flexDirection: 'row', gap: 10 }}>
                        <TouchableOpacity 
                            style={[styles.actionBtn, { backgroundColor: 'rgba(229, 28, 35, 0.15)' }]} 
                            onPress={() => { 
                                if (isCollaboratorOnly) leaveCollaborativeMixtape(activeEditMix.id);
                                else deleteMixtape(activeEditMix.id); 
                                setEditMixModalVisible(false); 
                            }}>
                            <Text style={{ color: '#e51c23', fontWeight: 'bold', fontSize: 16 }}>{isCollaboratorOnly ? 'Leave' : 'Delete'}</Text>
                        </TouchableOpacity>
                        <TouchableOpacity style={[styles.actionBtn, { backgroundColor: theme.text }]} onPress={saveMixEdit}>
                            <Text style={{ color: theme.background, fontWeight: 'bold', fontSize: 16 }}>Done</Text>
                        </TouchableOpacity>
                     </View>
                   </ScrollView>
                 );
             })()}
           </Animated.View>
        </KeyboardWrapper>
      </Modal>

      {/* UNIFIED CUSTOM ALERT MODAL */}
      <Modal visible={alertConfig.visible} transparent animationType="fade">
         <View style={styles.alertOverlay}>
            <View style={[styles.alertCard, { backgroundColor: theme.surface, borderColor: theme.border }]}>
               <Ionicons name="information-circle-outline" size={40} color={theme.text} style={{marginBottom: 15}} />
               <Text style={[styles.alertTitle, { color: theme.text }]}>{alertConfig.title}</Text>
               <Text style={[styles.alertMessage, { color: theme.textSecondary }]}>{alertConfig.message}</Text>
               <TouchableOpacity style={[styles.alertButton, { backgroundColor: theme.primary }]} onPress={() => setAlertConfig({ ...alertConfig, visible: false })}>
                  <Text style={styles.alertButtonText}>OK</Text>
               </TouchableOpacity>
            </View>
         </View>
      </Modal>

    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  centered: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  
  heroImage: { width: '100%', height: '100%', resizeMode: 'cover' },
  heroGradientBottom: { position: 'absolute', bottom: 0, left: 0, right: 0, height: '60%' },
  
  backButton: { position: 'absolute', left: 20, zIndex: 10, padding: 8, backgroundColor: 'rgba(0,0,0,0.5)', borderRadius: 25 },
  iconDropShadow: { textShadowColor: 'rgba(0,0,0,0.9)', textShadowOffset: { width: 0, height: 2 }, textShadowRadius: 6 },
  
  contentContainer: { paddingHorizontal: SIZES.padding, marginTop: -100, paddingBottom: 20 },
  tabletContentContainer: { maxWidth: 900, alignSelf: 'center', width: '100%', paddingHorizontal: '5%' },
  
  logo: { width: 280, height: 90, marginBottom: 15, alignSelf: 'flex-start', shadowColor: '#000', shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.6, shadowRadius: 10 },
  title: { fontSize: 32, fontWeight: 'bold', marginBottom: 10 },
  
  metaRow: { flexDirection: 'row', alignItems: 'center', gap: 12, marginBottom: 20 },
  metaText: { fontSize: 14, fontWeight: '600' },
  metaBadge: { borderWidth: 1, paddingHorizontal: 6, paddingVertical: 2, borderRadius: 4 },
  metaBadgeText: { fontSize: 10, fontWeight: 'bold' },

  mainActionRow: { flexDirection: 'row', gap: 15, marginBottom: 25, width: '100%' },
  playButton: { flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', paddingVertical: 12, borderRadius: 6 },
  playButtonText: { fontSize: 16, fontWeight: 'bold', marginLeft: 8 },
  actionBtnGlass: { flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', paddingVertical: 12, borderRadius: 6, borderWidth: 1 },
  actionBtnText: { fontSize: 16, fontWeight: 'bold', marginLeft: 8 },

  serverSection: { marginBottom: 25, width: '100%' },
  serverTitle: { fontSize: 13, fontWeight: '600', marginBottom: 10, marginLeft: 5, textTransform: 'uppercase', letterSpacing: 0.5 },
  serverScroll: { borderRadius: 30, borderWidth: 1, flexGrow: 0 }, 
  serverItem: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 16, paddingVertical: 8, borderRadius: 25 },
  serverItemText: { fontSize: 13, fontWeight: '700' },

  overview: { fontSize: 15, lineHeight: 22, marginBottom: 20 },

  iconActionRow: { flexDirection: 'row', justifyContent: 'flex-start', gap: 40, marginBottom: 30, marginLeft: 10 },
  iconActionItem: { alignItems: 'center' },
  iconActionText: { fontSize: 12, marginTop: 8 },

  section: { marginTop: 20 },
  sectionTitle: { fontSize: 18, fontWeight: 'bold', marginBottom: 15 },
  
  castItem: { width: 80, alignItems: 'center', marginRight: 15 },
  castImage: { width: 70, height: 70, borderRadius: 35, marginBottom: 8, backgroundColor: '#333' },
  castName: { fontSize: 12, textAlign: 'center', fontWeight: '500' },

  seasonScrollOuter: { marginBottom: 20 },
  seasonPill: { paddingHorizontal: 20, paddingVertical: 10, borderRadius: 20, marginRight: 10, borderWidth: 1 },
  seasonPillText: { fontSize: 14, fontWeight: 'bold' },

  episodeCard: { flexDirection: 'row', alignItems: 'center', padding: 10, marginBottom: 10, borderRadius: 8, borderWidth: 1 },
  
  episodeImageContainer: { position: 'relative', width: 120, height: 70, borderRadius: 6, overflow: 'hidden', backgroundColor: '#333' },
  episodeImage: { width: '100%', height: '100%' },
  watchedOverlay: { ...StyleSheet.absoluteFillObject, backgroundColor: 'rgba(0,0,0,0.45)', zIndex: 1 },
  watchedBadge: { position: 'absolute', top: 4, left: 4, flexDirection: 'row', alignItems: 'center', paddingHorizontal: 4, paddingVertical: 2, borderRadius: 4, gap: 2, zIndex: 5 },
  watchedBadgeText: { color: '#fff', fontSize: 8, fontWeight: 'bold', letterSpacing: 0.5 },
  progressBarBg: { position: 'absolute', bottom: 0, left: 0, right: 0, height: 4, backgroundColor: 'rgba(255,255,255,0.2)', zIndex: 5 },
  progressBarFill: { height: '100%' },
  
  episodeInfo: { flex: 1, marginLeft: 15, marginRight: 10 },
  episodeTitle: { fontSize: 14, fontWeight: 'bold', marginBottom: 4 },
  episodeDuration: { fontSize: 12, marginBottom: 4 },
  episodeOverview: { fontSize: 11 },

  tabRow: { flexDirection: 'row', marginBottom: 20, gap: 20 },
  tabButton: { flexDirection: 'row', alignItems: 'center', paddingBottom: 8 },
  tabText: { fontSize: 16, fontWeight: 'bold' },
  carouselCard: { marginRight: 15 },
  carouselImage: { width: 130, height: 195, borderRadius: 8, borderWidth: 1, backgroundColor: '#333' },

  mixCoverBase: { width: '100%', aspectRatio: 1, borderRadius: 12, borderWidth: 1, flexWrap: 'wrap', flexDirection: 'row', overflow: 'hidden' }, 
  
  bottomSheetOverlay: { flex: 1, justifyContent: 'flex-end', backgroundColor: 'rgba(0,0,0,0.6)' },
  bottomSheetContainer: { width: '100%', borderTopLeftRadius: 24, borderTopRightRadius: 24, padding: 20, paddingBottom: Platform.OS === 'ios' ? 40 : 20, borderWidth: 1, borderBottomWidth: 0 },
  
  desktopModalOverlay: { flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: 'rgba(0,0,0,0.7)' },
  desktopModalContainer: { width: 500, maxWidth: '90%', maxHeight: '85%', borderRadius: 24, padding: 24, borderWidth: 1, shadowColor: '#000', shadowOffset: { width: 0, height: 10 }, shadowOpacity: 0.3, shadowRadius: 20 },

  bottomSheetHandle: { width: 40, height: 5, backgroundColor: 'rgba(150,150,150,0.5)', borderRadius: 3, alignSelf: 'center', marginBottom: 20 },
  bottomSheetTitle: { fontSize: 20, fontWeight: 'bold' },
  
  createNewMixBtn: { flexDirection: 'row', alignItems: 'center', padding: 15, borderRadius: 16, borderWidth: 1, borderStyle: 'dashed', marginBottom: 15 },
  newMixForm: { padding: 15, borderRadius: 16, borderWidth: 1, marginBottom: 15 },
  mixInput: { height: 45, borderWidth: 1, borderRadius: 8, paddingHorizontal: 15, fontSize: 16, marginBottom: 10 },
  mixInputDesc: { height: 80, borderWidth: 1, borderRadius: 8, paddingHorizontal: 15, paddingTop: 10, fontSize: 14, textAlignVertical: 'top' },
  actionBtn: { flex: 1, paddingVertical: 12, borderRadius: 8, alignItems: 'center' },

  mixtapeRowCard: { flexDirection: 'row', alignItems: 'center', padding: 12, borderRadius: 16, borderWidth: 1, marginBottom: 10 },
  mixtapeCircleCheck: { width: 24, height: 24, borderRadius: 12, borderWidth: 2, marginRight: 15, justifyContent: 'center', alignItems: 'center' },
  mixtapeRowTitle: { fontSize: 16, fontWeight: '600' },
  mixtapeRowSubtitle: { fontSize: 13 },
  
  livePillSmall: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 6, paddingVertical: 2, borderRadius: 8, borderWidth: 1, gap: 4 },
  livePillTextSmall: { fontSize: 9, fontWeight: '900', letterSpacing: 0.5 },

  inputLabel: { fontSize: 11, fontWeight: 'bold', textTransform: 'uppercase', letterSpacing: 1, marginBottom: 8, marginLeft: 4 },
  stylePill: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 16, paddingVertical: 10, borderRadius: 20, borderWidth: 1 },

  alertOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.7)', justifyContent: 'center', alignItems: 'center', padding: 20 },
  alertCard: { width: '100%', maxWidth: 320, borderRadius: 16, padding: 20, borderWidth: 1, alignItems: 'center' },
  alertTitle: { fontSize: 18, fontWeight: 'bold', marginBottom: 10, textAlign: 'center' },
  alertMessage: { fontSize: 14, textAlign: 'center', marginBottom: 20 },
  alertButton: { paddingVertical: 12, paddingHorizontal: 30, borderRadius: 25 },
  alertButtonText: { color: '#fff', fontWeight: 'bold', fontSize: 16 }
});