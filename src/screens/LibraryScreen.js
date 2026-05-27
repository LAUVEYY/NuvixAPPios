// src/screens/LibraryScreen.js
import React, { useState, useEffect, useContext, useRef, memo, useCallback } from 'react';
import { 
  View, Text, StyleSheet, FlatList, Image, TouchableOpacity, ScrollView, Share, Alert,
  ActivityIndicator, Animated, useWindowDimensions, LayoutAnimation, UIManager, Platform, Modal, TextInput, KeyboardAvoidingView
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useNavigation, useFocusEffect, useRoute } from '@react-navigation/native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';
import * as ImagePicker from 'expo-image-picker';
import * as ImageManipulator from 'expo-image-manipulator';
import { ThemeContext } from '../context/ThemeContext';
import { LibraryContext } from '../context/LibraryContext';
import { SIZES } from '../constants/theme';

const KeyboardWrapper = Platform.OS === 'ios' ? KeyboardAvoidingView : View;

if (Platform.OS === 'android' && UIManager.setLayoutAnimationEnabledExperimental) {
  UIManager.setLayoutAnimationEnabledExperimental(true);
}

const API_KEY = "55550670b2e9a6b8c3c3c69b0bdf894f";
const BASE_URL = "https://api.themoviedb.org/3";
const IMG_BASE = "https://image.tmdb.org/t/p/w342";

// DYNAMIC MIXTAPE COVER COMPONENT 
const MixtapeCover = ({ mixtape, theme }) => {
  const style = mixtape.coverStyle || 'mosaic';
  const items = mixtape.items || [];
  
  if (style === 'custom' && mixtape.customCoverImage) {
      return <Image source={{ uri: mixtape.customCoverImage }} style={[styles.mixCoverBase, { borderColor: theme.border }]} />;
  }

  // 🔥 FIX: Movie icon perfectly centered for empty state
  if (items.length === 0) {
      return (
          <View style={[styles.mixCoverBase, { backgroundColor: theme.surface, borderColor: theme.border, flexDirection: 'column', flexWrap: 'nowrap', justifyContent: 'center', alignItems: 'center' }]}>
              <Ionicons name="film-outline" size={40} color={theme.textSecondary} />
          </View>
      );
  }

  const getImg = (idx) => `${IMG_BASE}${items[idx % items.length].poster_path}`;

  if (style === 'ambient') {
      return (
          <View style={[styles.mixCoverBase, { borderColor: theme.border, overflow: 'hidden' }]}>
              <Image source={{ uri: getImg(0) }} style={{ width: '120%', height: '120%', position: 'absolute', top: '-10%', left: '-10%', resizeMode: 'cover' }} blurRadius={40} />
              <LinearGradient colors={['rgba(255,255,255,0.1)', 'rgba(0,0,0,0.6)']} style={StyleSheet.absoluteFillObject} />
              <Text style={{ color: '#fff', fontWeight: '900', fontSize: 18, textAlign: 'center', alignSelf: 'center', marginTop: 'auto', marginBottom: 'auto', paddingHorizontal: 10 }} numberOfLines={2}>{mixtape.title}</Text>
          </View>
      );
  }

  if (style === 'stack') {
      return (
          <View style={[styles.mixCoverBase, { borderColor: theme.border, backgroundColor: theme.surface, overflow: 'hidden' }]}>
              {items.length >= 3 && <Image source={{ uri: getImg(2) }} style={{ position: 'absolute', width: '80%', height: '80%', top: -20, alignSelf: 'center', opacity: 0.5, borderRadius: 8, resizeMode: 'cover' }} />}
              {items.length >= 2 && <Image source={{ uri: getImg(1) }} style={{ position: 'absolute', width: '90%', height: '90%', top: -10, alignSelf: 'center', opacity: 0.8, borderRadius: 8, resizeMode: 'cover' }} />}
              <Image source={{ uri: getImg(0) }} style={{ width: '100%', height: '100%', borderRadius: 8, resizeMode: 'cover' }} />
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

const LibraryCard = memo(({ item, itemWidth, theme, navigateToDetails, tappedCardId, setTappedCardId, isHistory, activeMixtapeId }) => {
  const isTapped = tappedCardId === item.id;
  const [hasMounted, setHasMounted] = useState(false);
  const [isExiting, setIsExiting] = useState(false);
  const [bannerText, setBannerText] = useState(null);

  const fadeAnim = useRef(new Animated.Value(0)).current;
  const cardScale = useRef(new Animated.Value(1)).current;
  const cardOpacity = useRef(new Animated.Value(1)).current; 
  const iconScale = useRef(new Animated.Value(1)).current;
  
  const { toggleWatchlist, isInWatchlist, removeFromHistory, toggleInMixtape } = useContext(LibraryContext);
  const inList = isInWatchlist(item.id);

  const itemHeight = itemWidth * 1.5;
  const rawType = item.media_type || item.type || item.mediaType;
  const mediaType = rawType ? String(rawType).toLowerCase() : (item.name || item.first_air_date ? 'tv' : 'movie');

  useEffect(() => {
    let isMounted = true;
    let timeoutId;
    
    cardScale.setValue(1);
    cardOpacity.setValue(1);
    fadeAnim.setValue(0);
    setHasMounted(false);
    setIsExiting(false);

    if (item.latest_update_text) {
        setBannerText(item.latest_update_text);
    } else {
        setBannerText(null);
        if (mediaType === 'movie' && item.release_date && new Date(item.release_date) > new Date()) {
            setBannerText("Coming Soon");
        } else if (mediaType === 'tv') {
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
    }
    
    return () => { 
      isMounted = false; 
      if (timeoutId) clearTimeout(timeoutId);
    };
  }, [item, mediaType]);

  useEffect(() => {
    if (isTapped) {
      setHasMounted(true);
      Animated.timing(fadeAnim, { toValue: 1, duration: 80, useNativeDriver: true }).start();
    } else if (hasMounted) {
      Animated.timing(fadeAnim, { toValue: 0, duration: 150, useNativeDriver: true }).start();
    }
  }, [isTapped]);

  const handlePressIn = () => { if (!isExiting) Animated.timing(cardScale, { toValue: 0.96, duration: 60, useNativeDriver: true }).start(); };
  const handlePressOut = () => { if (!isExiting) Animated.spring(cardScale, { toValue: 1, friction: 5, tension: 80, useNativeDriver: true }).start(); };

  const handlePress = () => {
    if (isExiting) return;
    if (isTapped) {
      setTappedCardId(null);
      navigateToDetails(item.id, mediaType);
    } else {
      Animated.sequence([
        Animated.timing(cardScale, { toValue: 0.95, duration: 60, useNativeDriver: true }),
        Animated.spring(cardScale, { toValue: 1, friction: 5, tension: 80, useNativeDriver: true })
      ]).start();
      setTappedCardId(item.id);
    }
  };

  const handleActionPress = () => {
    const isRemovingFromView = activeMixtapeId || (isHistory && !inList) || (!isHistory && !activeMixtapeId && inList);

    if (isRemovingFromView) {
        setIsExiting(true);
        Animated.parallel([
            Animated.timing(cardScale, { toValue: 0.5, duration: 150, useNativeDriver: true }),
            Animated.timing(cardOpacity, { toValue: 0, duration: 150, useNativeDriver: true })
        ]).start(() => {
            const customSpringConfig = { duration: 400, update: { type: LayoutAnimation.Types.spring, springDamping: 0.7 }, delete: { type: LayoutAnimation.Types.easeIn, property: LayoutAnimation.Properties.opacity } };
            LayoutAnimation.configureNext(customSpringConfig);
            
            if (activeMixtapeId) toggleInMixtape(activeMixtapeId, item);
            else if (isHistory && !inList) removeFromHistory(item.id);
            else toggleWatchlist(item);
            
            setTappedCardId(null);
        });
    } else {
        Animated.sequence([
          Animated.timing(iconScale, { toValue: 1.4, duration: 100, useNativeDriver: true }),
          Animated.spring(iconScale, { toValue: 1, friction: 4, tension: 60, useNativeDriver: true })
        ]).start();
        if (isHistory && !inList) removeFromHistory(item.id);
        else toggleWatchlist(item);
        setTimeout(() => setTappedCardId(null), 300);
    }
  };

  if (!item.poster_path) return null;

  return (
    <TouchableOpacity activeOpacity={1} delayPressIn={0} onPressIn={handlePressIn} onPressOut={handlePressOut} onPress={handlePress} style={{ width: itemWidth, height: itemHeight }}>
      <Animated.View style={[styles.cardWrapper, { width: '100%', height: '100%', transform: [{ scale: cardScale }], opacity: cardOpacity }]}>
        <Image source={{ uri: `${IMG_BASE}${item.poster_path}` }} style={[styles.cardImage, { borderColor: theme.border }]} />
        {bannerText && (
          <View style={[styles.bannerTag, { backgroundColor: theme.primary }]}>
            <Text style={styles.bannerText}>{bannerText}</Text>
          </View>
        )}
        {hasMounted && (
          <Animated.View pointerEvents={isTapped ? "auto" : "none"} style={[StyleSheet.absoluteFillObject, styles.overlayBase, { opacity: fadeAnim }]}>
            <TouchableOpacity style={styles.addToListTopRight} delayPressIn={0} onPress={handleActionPress}>
               <Animated.View style={{ transform: [{ scale: iconScale }] }}>
                 <Ionicons 
                    name={activeMixtapeId ? "trash-outline" : (isHistory && !inList ? "trash-outline" : (inList ? "checkmark-circle" : "add-circle"))} 
                    size={32} 
                    color={activeMixtapeId ? "#e51c23" : (isHistory && !inList ? "#e51c23" : (inList ? theme.primary : "#fff"))} 
                    style={styles.iconDropShadow} 
                 />
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

export default function LibraryScreen() {
  const { theme, isDarkMode } = useContext(ThemeContext);
  const { watchlist, history, mixtapes, createMixtape, updateMixtapeStyle, deleteMixtape } = useContext(LibraryContext);
  
  const navigation = useNavigation();
  const route = useRoute();
  const insets = useSafeAreaInsets();
  const { width, height } = useWindowDimensions();

  const [activeTab, setActiveTab] = useState('watchlist'); 
  const [latestUpdates, setLatestUpdates] = useState([]);
  const [loadingLatest, setLoadingLatest] = useState(false);
  const [tappedCardId, setTappedCardId] = useState(null);

  const [activePlaylistViewId, setActivePlaylistViewId] = useState(null);

  const [editMixModalVisible, setEditMixModalVisible] = useState(false);
  const [activeEditMix, setActiveEditMix] = useState(null);
  const [mixTitleEdit, setMixTitleEdit] = useState('');
  const [mixDescEdit, setMixDescEdit] = useState('');
  const [createMixModalVisible, setCreateMixModalVisible] = useState(false);

  const isTabletLandscape = width >= 768 && width > height;
  const availableWidth = isTabletLandscape ? (width - 250) : width;
  const contentWidth = availableWidth - (SIZES.padding * 2);
  const gridSpacing = 10;
  
  // Movies Grid Math
  const idealMovieWidth = 115;
  const numColumns = Math.max(3, Math.floor((contentWidth + gridSpacing) / (idealMovieWidth + gridSpacing)));
  const itemWidth = Math.floor((contentWidth - (gridSpacing * (numColumns - 1))) / numColumns);
  
  // Mixtape Grid Math
  const idealMixtapeWidth = 160;
  const numMixtapeColumns = Math.max(2, Math.floor((contentWidth + gridSpacing) / (idealMixtapeWidth + gridSpacing)));
  const mixtapeWidth = Math.floor((contentWidth - (gridSpacing * (numMixtapeColumns - 1))) / numMixtapeColumns); 

  // 🔥 FIX: Removed double wrapper to fix React Navigation Crash
  useFocusEffect(
    useCallback(() => {
      if (route.params?.viewMixtapeId) {
        setActiveTab('mixtapes');
        setActivePlaylistViewId(route.params.viewMixtapeId);
        navigation.setParams({ viewMixtapeId: undefined }); 
      }
    }, [route.params?.viewMixtapeId, navigation])
  );

  const navigateToDetails = useCallback((id, media_type) => {
    const type = media_type || (id > 100000 ? 'movie' : 'tv');
    setTappedCardId(null);
    navigation.navigate('Details', { id, type }); 
  }, [navigation]);

  const fetchLatestUpdates = async () => {
    setLoadingLatest(true);
    try {
      if (watchlist.length === 0) {
        setLatestUpdates([]);
        setLoadingLatest(false);
        return;
      }
      const updates = [];
      const today = new Date();
      const oneMonthAgo = new Date();
      oneMonthAgo.setMonth(today.getMonth() - 1);

      await Promise.all(watchlist.map(async (item) => {
        try {
          const rawType = item.media_type || item.type || item.mediaType;
          const mediaType = rawType ? String(rawType).toLowerCase() : (item.name || item.first_air_date ? 'tv' : 'movie');
          
          if (mediaType === 'movie') {
             if (item.release_date && new Date(item.release_date) > today) {
                 updates.push({ ...item, latest_update_text: "Coming Soon", sort_date: new Date(item.release_date).getTime() });
             }
             return;
          }

          if (mediaType === 'tv') {
              const res = await fetch(`${BASE_URL}/tv/${item.id}?api_key=${API_KEY}`);
              const details = await res.json();
              if (!details) return;

              let isAdded = false;
              if (details.next_episode_to_air && new Date(details.next_episode_to_air.air_date) > today) {
                  updates.push({ ...item, latest_update_text: "Coming Soon", sort_date: new Date(details.next_episode_to_air.air_date).getTime() });
                  isAdded = true;
              }

              if (!isAdded && details.last_air_date) {
                  const lastAirDate = new Date(details.last_air_date);
                  if (lastAirDate >= oneMonthAgo) {
                      let bannerText = details.last_episode_to_air?.episode_number === 1 ? "New Season" : "New Episode";
                      updates.push({ ...item, latest_update_text: bannerText, sort_date: lastAirDate.getTime() });
                  }
              }
          }
        } catch (e) { }
      }));
      updates.sort((a, b) => b.sort_date - a.sort_date);
      setLatestUpdates(updates);
    } catch (error) { console.error(error); } 
    finally { setLoadingLatest(false); }
  };

  useEffect(() => {
    if (activeTab === 'latest') fetchLatestUpdates();
  }, [activeTab, watchlist]);

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

  const handleCreateMixtape = () => {
      if (mixTitleEdit.trim()) {
          createMixtape(mixTitleEdit.trim(), mixDescEdit.trim());
          setMixTitleEdit('');
          setMixDescEdit('');
          setCreateMixModalVisible(false);
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

  const handleShareMixtape = async (mix) => {
      const shareText = `Check out my Mixtape "${mix.title}" on Nuvix!\nIt has ${mix.items.length} movies/shows.`;
      try {
          if (Platform.OS === 'web') {
              if (navigator && navigator.clipboard) {
                  await navigator.clipboard.writeText(shareText);
                  alert("Mixtape info copied to clipboard!");
              }
          } else {
              await Share.share({ message: shareText, title: mix.title });
          }
      } catch (e) {}
  };

  let displayData = [];
  if (activeTab === 'watchlist') displayData = watchlist;
  else if (activeTab === 'history') displayData = history;
  else if (activeTab === 'latest') displayData = latestUpdates;

  const renderPill = (id, label, icon) => {
    const isActive = activeTab === id;
    return (
      <TouchableOpacity 
        style={[
          styles.pillBtn, 
          { backgroundColor: isActive ? (isDarkMode ? '#fff' : '#000') : (isDarkMode ? '#222' : '#e5e5e5') }
        ]}
        onPress={() => { 
          LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
          setActiveTab(id); 
          setTappedCardId(null); 
          setActivePlaylistViewId(null);
        }}
        activeOpacity={0.8}
      >
        <Ionicons 
          name={icon} 
          size={16} 
          color={isActive ? (isDarkMode ? '#000' : '#fff') : theme.text} 
          style={{ marginRight: 8 }} 
        />
        <Text style={[
          styles.pillText, 
          { color: isActive ? (isDarkMode ? '#000' : '#fff') : theme.text, fontWeight: isActive ? 'bold' : '600' }
        ]}>
          {label}
        </Text>
      </TouchableOpacity>
    );
  };

  const renderEmptyState = () => {
    let icon, title, subtitle;
    if (activeTab === 'watchlist') {
      icon = 'bookmark-outline'; title = 'Your watchlist is empty'; subtitle = 'Save movies and shows to watch later';
    } else if (activeTab === 'history') {
      icon = 'time-outline'; title = 'Your history is empty'; subtitle = 'Content you watch will appear here';
    } else if (activeTab === 'latest') {
      icon = 'notifications-outline'; title = 'No recent updates'; subtitle = 'Add active TV shows to your watchlist to see new episodes here';
    } else {
      icon = 'albums-outline'; title = 'No Mixtapes Yet'; subtitle = 'Create a custom mixtape from any movie details screen!';
    }

    return (
      <View style={styles.emptyContainer}>
        <Ionicons name={icon} size={80} color={theme.textSecondary} style={{ marginBottom: 15, opacity: 0.5 }} />
        <Text style={[styles.emptyTitle, { color: theme.text }]}>{title}</Text>
        <Text style={[styles.emptySubtitle, { color: theme.textSecondary }]}>{subtitle}</Text>
      </View>
    );
  };

  const renderHeader = () => (
    <View style={{ paddingBottom: 25 }}>
      <Text style={[styles.mainTitle, { color: theme.text }]}>My Library</Text>
      <Text style={[styles.subTitle, { color: theme.textSecondary }]}>Your saved content</Text>
      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.pillsContainer}>
        {renderPill('watchlist', 'Watchlist', 'bookmark-outline')}
        {renderPill('mixtapes', 'Mixtapes', 'albums-outline')}
        {renderPill('history', 'History', 'time-outline')}
        {renderPill('latest', 'Latest', 'notifications-outline')}
      </ScrollView>
    </View>
  );

  if (activeTab === 'mixtapes' && activePlaylistViewId) {
      const activeMix = mixtapes.find(m => m.id === activePlaylistViewId);
      if (!activeMix) {
          setActivePlaylistViewId(null);
          return null;
      }
      return (
          <View style={[styles.container, { backgroundColor: theme.background, paddingTop: Math.max(insets.top, 20) }]}>
             <FlatList
                key={`${numColumns}-${width}-mixView`}
                data={activeMix.items}
                keyExtractor={(item) => item.id.toString()}
                numColumns={numColumns}
                showsVerticalScrollIndicator={false}
                contentContainerStyle={{ paddingHorizontal: SIZES.padding, paddingBottom: 100 }}
                columnWrapperStyle={activeMix.items.length > 0 ? { gap: gridSpacing, marginBottom: gridSpacing } : null}
                onScrollBeginDrag={() => setTappedCardId(null)}
                ListHeaderComponent={
                    <View style={{ marginBottom: 30 }}>
                        <TouchableOpacity onPress={() => setActivePlaylistViewId(null)} style={{ alignSelf: 'flex-start', padding: 5, marginBottom: 15 }}>
                            <Ionicons name="chevron-back" size={28} color={theme.text} />
                        </TouchableOpacity>
                        
                        <View style={{ alignItems: 'center' }}>
                            <View style={{ width: 180, height: 180, shadowColor: '#000', shadowOffset: { width: 0, height: 10 }, shadowOpacity: 0.3, shadowRadius: 15 }}>
                                <MixtapeCover mixtape={activeMix} theme={theme} />
                            </View>
                            <Text style={{ color: theme.text, fontSize: 26, fontWeight: '900', marginTop: 20, textAlign: 'center' }}>{activeMix.title}</Text>
                            {activeMix.description ? <Text style={{ color: theme.textSecondary, fontSize: 14, marginTop: 5, textAlign: 'center', maxWidth: 300 }}>{activeMix.description}</Text> : null}
                            <Text style={{ color: theme.textSecondary, fontSize: 12, fontWeight: 'bold', marginTop: 10, textTransform: 'uppercase' }}>{activeMix.items.length} ITEMS</Text>
                            
                            <View style={{ flexDirection: 'row', gap: 15, marginTop: 25 }}>
                                <TouchableOpacity onPress={() => openMixEditor(activeMix)} style={[styles.mixActionBtn, { backgroundColor: theme.surfaceGlass, borderColor: theme.border }]}>
                                    <Ionicons name="pencil" size={18} color={theme.text} />
                                    <Text style={{ color: theme.text, fontWeight: 'bold', marginLeft: 8 }}>Edit</Text>
                                </TouchableOpacity>
                                <TouchableOpacity onPress={() => handleShareMixtape(activeMix)} style={[styles.mixActionBtn, { backgroundColor: theme.text, borderColor: theme.text }]}>
                                    <Ionicons name="share-outline" size={18} color={theme.background} />
                                    <Text style={{ color: theme.background, fontWeight: 'bold', marginLeft: 8 }}>Share</Text>
                                </TouchableOpacity>
                            </View>
                        </View>
                    </View>
                }
                ListEmptyComponent={
                    <View style={{ alignItems: 'center', marginTop: 30 }}>
                        <Ionicons name="film-outline" size={50} color={theme.textSecondary} style={{ opacity: 0.5 }} />
                        <Text style={{ color: theme.textSecondary, marginTop: 10 }}>No items in this mixtape yet.</Text>
                    </View>
                }
                renderItem={({ item }) => (
                    <LibraryCard 
                      item={item} itemWidth={itemWidth} theme={theme} navigateToDetails={navigateToDetails}
                      tappedCardId={tappedCardId} setTappedCardId={setTappedCardId} activeMixtapeId={activeMix.id}
                    />
                )}
             />
             
             {/* Edit Modal */}
             <Modal visible={editMixModalVisible} transparent animationType="slide">
                <KeyboardWrapper behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={styles.bottomSheetOverlay}>
                   <View style={[styles.bottomSheetContainer, { backgroundColor: theme.background, borderColor: theme.border }]}>
                     <View style={styles.bottomSheetHandle} />
                     <Text style={[styles.bottomSheetTitle, { color: theme.text }]}>Edit Mixtape</Text>

                     {activeEditMix && (
                       <ScrollView showsVerticalScrollIndicator={false}>
                         <View style={{ alignItems: 'center', marginBottom: 25 }}>
                           <View style={{ width: 140, height: 140 }}>
                             <MixtapeCover mixtape={activeEditMix} theme={theme} />
                           </View>
                         </View>

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
                            <TouchableOpacity style={[styles.actionBtn, { backgroundColor: 'rgba(229, 28, 35, 0.15)' }]} onPress={() => { deleteMixtape(activeEditMix.id); setEditMixModalVisible(false); setActivePlaylistViewId(null); }}>
                                <Text style={{ color: '#e51c23', fontWeight: 'bold', fontSize: 16 }}>Delete</Text>
                            </TouchableOpacity>
                            <TouchableOpacity style={[styles.actionBtn, { backgroundColor: theme.text }]} onPress={saveMixEdit}>
                                <Text style={{ color: theme.background, fontWeight: 'bold', fontSize: 16 }}>Done</Text>
                            </TouchableOpacity>
                         </View>
                       </ScrollView>
                     )}
                   </View>
                </KeyboardWrapper>
             </Modal>
          </View>
      );
  }

  return (
    <View style={[styles.container, { backgroundColor: theme.background, paddingTop: Math.max(insets.top, 20) }]}>
      
      {activeTab === 'latest' && loadingLatest ? (
        <View style={{ flex: 1, paddingHorizontal: SIZES.padding }}>
          {renderHeader()}
          <View style={styles.loadingContainer}>
            <ActivityIndicator size="large" color={theme.primary} />
          </View>
        </View>
      ) : activeTab === 'mixtapes' ? (
        <View style={{ flex: 1 }}>
           <FlatList
              key={`mixtapes-grid-${numMixtapeColumns}-${width}`} 
              data={[{ id: 'CREATE_NEW' }, ...mixtapes]} 
              keyExtractor={(item) => item.id}
              numColumns={numMixtapeColumns} 
              ListHeaderComponent={renderHeader()}
              showsVerticalScrollIndicator={false}
              contentContainerStyle={{ paddingHorizontal: SIZES.padding, paddingBottom: 100 }}
              columnWrapperStyle={{ gap: gridSpacing, marginBottom: 25 }}
              renderItem={({ item }) => {
                if (item.id === 'CREATE_NEW') {
                    return (
                        <TouchableOpacity activeOpacity={0.8} style={{ width: mixtapeWidth }} onPress={() => { setMixTitleEdit(''); setMixDescEdit(''); setCreateMixModalVisible(true); }}>
                            {/* 🔥 FIX: Center-Middle geometry explicit columns flex-nowrap */}
                            <View style={[styles.mixCoverBase, { backgroundColor: theme.surfaceGlass, borderColor: theme.border, borderStyle: 'dashed', flexDirection: 'column', flexWrap: 'nowrap', justifyContent: 'center', alignItems: 'center' }]}>
                                <Ionicons name="add" size={40} color={theme.textSecondary} />
                            </View>
                            <Text style={{ color: theme.textSecondary, fontWeight: 'bold', fontSize: 16, marginTop: 10, textAlign: 'center' }}>New Mixtape</Text>
                        </TouchableOpacity>
                    );
                }
                return (
                    <TouchableOpacity activeOpacity={0.8} style={{ width: mixtapeWidth }} onPress={() => setActivePlaylistViewId(item.id)}>
                        <View style={{ width: '100%', aspectRatio: 1 }}>
                            <MixtapeCover mixtape={item} theme={theme} />
                        </View>
                        <Text style={{ color: theme.text, fontWeight: 'bold', fontSize: 16, marginTop: 10 }} numberOfLines={1}>{item.title}</Text>
                        <Text style={{ color: theme.textSecondary, fontSize: 13, marginTop: 2 }}>{item.items.length} items</Text>
                    </TouchableOpacity>
                );
              }}
           />
        </View>
      ) : displayData.length === 0 ? (
        <View style={{ flex: 1, paddingHorizontal: SIZES.padding }}>
          {renderHeader()}
          {renderEmptyState()}
        </View>
      ) : (
        <FlatList
          key={`${numColumns}-${width}-${activeTab}`}
          data={displayData}
          keyExtractor={(item) => item.id.toString()}
          numColumns={numColumns}
          ListHeaderComponent={renderHeader()}
          showsVerticalScrollIndicator={false}
          contentContainerStyle={{ paddingHorizontal: SIZES.padding, paddingBottom: 100 }}
          columnWrapperStyle={{ gap: gridSpacing, marginBottom: gridSpacing }}
          onScrollBeginDrag={() => setTappedCardId(null)}
          removeClippedSubviews={false} 
          initialNumToRender={12}
          maxToRenderPerBatch={8}
          windowSize={5}
          renderItem={({ item }) => (
            <LibraryCard 
              item={item} 
              itemWidth={itemWidth} 
              theme={theme} 
              navigateToDetails={navigateToDetails}
              tappedCardId={tappedCardId}
              setTappedCardId={setTappedCardId}
              isHistory={activeTab === 'history'}
            />
          )}
        />
      )}

      <Modal visible={createMixModalVisible} transparent animationType="slide">
        <KeyboardWrapper behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={styles.bottomSheetOverlay}>
           <View style={[styles.bottomSheetContainer, { backgroundColor: theme.background, borderColor: theme.border }]}>
             <View style={styles.bottomSheetHandle} />
             <Text style={[styles.bottomSheetTitle, { color: theme.text }]}>Create New Mixtape</Text>

             <Text style={[styles.inputLabel, { color: theme.textSecondary }]}>MIXTAPE TITLE</Text>
             <TextInput style={[styles.mixInput, { backgroundColor: theme.surface, color: theme.text, borderColor: theme.border, marginBottom: 15 }]} value={mixTitleEdit} onChangeText={setMixTitleEdit} autoFocus />

             <Text style={[styles.inputLabel, { color: theme.textSecondary }]}>DESCRIPTION (OPTIONAL)</Text>
             <TextInput style={[styles.mixInputDesc, { backgroundColor: theme.surface, color: theme.text, borderColor: theme.border, marginBottom: 20 }]} value={mixDescEdit} onChangeText={setMixDescEdit} multiline />

             <View style={{ flexDirection: 'row', gap: 10 }}>
                <TouchableOpacity style={[styles.actionBtn, { backgroundColor: theme.surfaceGlass }]} onPress={() => setCreateMixModalVisible(false)}>
                    <Text style={{ color: theme.text, fontWeight: 'bold', fontSize: 16 }}>Cancel</Text>
                </TouchableOpacity>
                <TouchableOpacity style={[styles.actionBtn, { backgroundColor: mixTitleEdit.trim() ? theme.primary : theme.surfaceGlass }]} disabled={!mixTitleEdit.trim()} onPress={handleCreateMixtape}>
                    <Text style={{ color: mixTitleEdit.trim() ? '#fff' : theme.textSecondary, fontWeight: 'bold', fontSize: 16 }}>Create</Text>
                </TouchableOpacity>
             </View>
           </View>
        </KeyboardWrapper>
      </Modal>

    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  loadingContainer: { flex: 1, justifyContent: 'center', alignItems: 'center', paddingBottom: 100 },

  mainTitle: { fontSize: 32, fontWeight: '900', marginBottom: 5 },
  subTitle: { fontSize: 16, fontWeight: '500', marginBottom: 20 },

  pillsContainer: { flexDirection: 'row', gap: 12, paddingRight: 20 },
  pillBtn: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 18, paddingVertical: 10, borderRadius: 25 },
  pillText: { fontSize: 14 },

  emptyContainer: { flex: 1, justifyContent: 'center', alignItems: 'center', paddingBottom: 100 },
  emptyTitle: { fontSize: 20, fontWeight: 'bold', marginBottom: 8 },
  emptySubtitle: { fontSize: 14, textAlign: 'center', maxWidth: 250 },

  cardWrapper: { position: 'relative' },
  cardImage: { width: '100%', height: '100%', resizeMode: 'cover', borderWidth: 1, backgroundColor: 'rgba(255,255,255,0.05)', borderRadius: 8 },
  bannerTag: { position: 'absolute', top: 10, left: 0, paddingHorizontal: 6, paddingVertical: 3, borderTopRightRadius: 4, borderBottomRightRadius: 4, zIndex: 5 },
  bannerText: { color: '#fff', fontSize: 9, fontWeight: 'bold', textTransform: 'uppercase' },
  overlayBase: { overflow: 'hidden', zIndex: 10, borderRadius: 8 },
  addToListTopRight: { position: 'absolute', top: 6, right: 6, zIndex: 20 },
  iconDropShadow: { textShadowColor: 'rgba(0,0,0,0.5)', textShadowOffset: { width: 0, height: 2 }, textShadowRadius: 4 },
  cardGradientBottom: { position: 'absolute', bottom: 0, left: 0, right: 0, padding: 8, paddingTop: 30, justifyContent: 'flex-end' },
  cardOverlayTitle: { color: '#ffffff', fontSize: 12, fontWeight: 'bold', textShadowColor: 'rgba(0,0,0,0.8)', textShadowOffset: { width: 0, height: 1 }, textShadowRadius: 3 },

  mixCoverBase: { width: '100%', aspectRatio: 1, borderRadius: 12, borderWidth: 1, flexWrap: 'wrap', flexDirection: 'row', overflow: 'hidden' }, 
  bottomSheetOverlay: { flex: 1, justifyContent: 'flex-end', backgroundColor: 'rgba(0,0,0,0.6)' },
  bottomSheetContainer: { width: '100%', borderTopLeftRadius: 24, borderTopRightRadius: 24, padding: 20, paddingBottom: Platform.OS === 'ios' ? 40 : 20, borderWidth: 1, borderBottomWidth: 0 },
  bottomSheetHandle: { width: 40, height: 5, backgroundColor: 'rgba(150,150,150,0.5)', borderRadius: 3, alignSelf: 'center', marginBottom: 20 },
  bottomSheetTitle: { fontSize: 20, fontWeight: 'bold', marginBottom: 20 },
  
  inputLabel: { fontSize: 11, fontWeight: 'bold', textTransform: 'uppercase', letterSpacing: 1, marginBottom: 8, marginLeft: 4 },
  mixInput: { height: 50, borderWidth: 1, borderRadius: 12, paddingHorizontal: 15, fontSize: 16 },
  mixInputDesc: { height: 80, borderWidth: 1, borderRadius: 12, paddingHorizontal: 15, paddingTop: 12, fontSize: 14, textAlignVertical: 'top' },
  stylePill: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 16, paddingVertical: 10, borderRadius: 20, borderWidth: 1 },
  actionBtn: { flex: 1, paddingVertical: 14, borderRadius: 8, alignItems: 'center' },
  mixActionBtn: { flex: 1, paddingVertical: 12, borderRadius: 20, borderWidth: 1, flexDirection: 'row', justifyContent: 'center', alignItems: 'center' }
});