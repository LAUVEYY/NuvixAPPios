// src/screens/LibraryScreen.js
import React, { useState, useEffect, useContext, useRef, memo, useCallback } from 'react';
import { 
  View, Text, StyleSheet, FlatList, Image, TouchableOpacity, ScrollView, Share,
  ActivityIndicator, Animated, useWindowDimensions, LayoutAnimation, UIManager, Platform, Modal, TextInput, KeyboardAvoidingView, PanResponder, Dimensions
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useNavigation, useFocusEffect, useRoute } from '@react-navigation/native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';
import * as ImagePicker from 'expo-image-picker';
import * as ImageManipulator from 'expo-image-manipulator';
import { ThemeContext } from '../context/ThemeContext';
import { LibraryContext } from '../context/LibraryContext';
import { AuthContext } from '../context/AuthContext';
import { SIZES } from '../constants/theme';

const KeyboardWrapper = Platform.OS === 'ios' ? KeyboardAvoidingView : View;

if (Platform.OS === 'android' && UIManager.setLayoutAnimationEnabledExperimental) {
  UIManager.setLayoutAnimationEnabledExperimental(true);
}

const API_KEY = "55550670b2e9a6b8c3c3c69b0bdf894f";
const BASE_URL = "https://api.themoviedb.org/3";
const IMG_BASE = "https://image.tmdb.org/t/p/w342";

// Restored Domain Auto-detect
const APP_DOMAIN = Platform.OS === 'web' && typeof window !== 'undefined' 
  ? window.location.origin 
  : "https://nuvix.fun"; 
const APP_NAME = "Nuvix"; 

const toTitleCase = (str) => {
  if (!str) return '';
  return str.replace(/\w\S*/g, (txt) => txt.charAt(0).toUpperCase() + txt.substr(1).toLowerCase());
};

const MixtapeCover = ({ mixtape, theme }) => {
  const style = mixtape.coverStyle || 'mosaic';
  const items = mixtape.items || [];
  
  if (style === 'custom' && mixtape.customCoverImage) {
      return <Image source={{ uri: mixtape.customCoverImage }} style={[styles.mixCoverBase, { borderColor: theme.border }]} />;
  }

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
              <Text style={{ color: '#fff', fontWeight: '900', fontSize: 18, textAlign: 'center', alignSelf: 'center', marginTop: 'auto', marginBottom: 'auto', paddingHorizontal: 10 }} numberOfLines={2}>{toTitleCase(mixtape.title)}</Text>
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
    
    cardScale.setValue(1); cardOpacity.setValue(1); fadeAnim.setValue(0);
    setHasMounted(false); setIsExiting(false);

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
    
    return () => { isMounted = false; if (timeoutId) clearTimeout(timeoutId); };
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

// Group Avatars correctly implements the DB fallback colors natively
const CollabAvatars = ({ mixtape, theme, currentUserUid, activeProfile, activeProfileKey }) => {
  const collabs = mixtape.collaborators || [];
  
  const creatorName = mixtape.ownerName || mixtape.creatorName || mixtape.originalOwner || activeProfile?.name || 'My Profile';
  const creatorColor = mixtape.ownerColor || activeProfile?.avatarColor || theme.primary;
  const creatorPic = mixtape.ownerImage || mixtape.creatorImage || mixtape.creatorProfilePic || activeProfile?.avatarImage || activeProfile?.avatar || activeProfile?.photoURL;
  const creatorInitial = creatorName.charAt(0).toUpperCase();

  const uniqueCollabs = [];
  const seenKeys = new Set();
  
  for (const c of collabs) {
      const key = c.profileKey || c.uid; 
      if (c && key && !seenKeys.has(key)) {
          seenKeys.add(key);
          uniqueCollabs.push(c);
      }
  }

  if (!uniqueCollabs || uniqueCollabs.length === 0) {
      return (
          <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 12 }}>
              {creatorPic ? (
                  <Image source={{ uri: creatorPic }} style={{ width: 28, height: 28, borderRadius: 14, marginRight: 8, borderWidth: 1, borderColor: theme.border }} />
              ) : (
                  <View style={{ width: 28, height: 28, borderRadius: 14, marginRight: 8, borderWidth: 1, borderColor: theme.border, backgroundColor: creatorColor, justifyContent: 'center', alignItems: 'center' }}>
                      <Text style={{ color: '#fff', fontSize: 12, fontWeight: 'bold' }}>{creatorInitial}</Text>
                  </View>
              )}
              <Text style={{ color: theme.text, fontWeight: '600', fontSize: 16 }}>{creatorName}</Text>
          </View>
      );
  }

  const sortedCollabs = [...uniqueCollabs].sort((a, b) => {
      if (a.uid === currentUserUid && a.profileKey === activeProfileKey) return -1;
      if (b.uid === currentUserUid && b.profileKey === activeProfileKey) return 1;
      return 0;
  });

  const maxVisible = 4;
  const avatars = sortedCollabs.slice(0, maxVisible);
  const extra = uniqueCollabs.length > maxVisible ? uniqueCollabs.length - maxVisible : 0;
  let displayString = creatorName;
  if (extra > 0) displayString += ` + ${extra} others`;

  return (
      <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 15 }}>
          <View style={{ flexDirection: 'row', marginRight: 10 }}>
              {avatars.map((c, index) => {
                  const hasPic = c.pic && c.pic.length > 0;
                  const initial = c.name ? c.name.charAt(0).toUpperCase() : '?';
                  const color = c.color || theme.primary;

                  return (
                      <View key={`${c.profileKey || c.uid}-${index}`}
                          style={[styles.stackAvatar, {
                              borderColor: theme.background, backgroundColor: hasPic ? theme.surface : color,
                              marginLeft: index > 0 ? -12 : 0, zIndex: maxVisible - index,
                              justifyContent: 'center', alignItems: 'center', overflow: 'hidden'
                          }]}
                      >
                          {hasPic ? (
                              <Image source={{ uri: c.pic }} style={{ width: '100%', height: '100%' }} />
                          ) : (
                              <Text style={{ color: '#fff', fontSize: 12, fontWeight: 'bold' }}>{initial}</Text>
                          )}
                      </View>
                  );
              })}
          </View>
          <Text style={{ color: theme.text, fontWeight: '600', fontSize: 16 }}>{displayString}</Text>
      </View>
  );
};

export default function LibraryScreen() {
  const { theme, isDarkMode } = useContext(ThemeContext);
  const { activeProfile, user, activeProfileKey } = useContext(AuthContext); 
  const { watchlist, history, mixtapes, createMixtape, updateMixtapeStyle, deleteMixtape, leaveCollaborativeMixtape, shareMixtape, toggleInMixtape } = useContext(LibraryContext);
  
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
  const [shareModalVisible, setShareModalVisible] = useState(false);
  const [activeShareMix, setActiveShareMix] = useState(null);
  const [sharingId, setSharingId] = useState(null);

  const [alertConfig, setAlertConfig] = useState({ visible: false, title: '', message: '' });
  const showAlert = (title, message) => setAlertConfig({ visible: true, title, message });

  const isTabletLandscape = width >= 768 && width > height;
  const isTabletOrWeb = width >= 768; 
  const availableWidth = isTabletLandscape ? (width - 250) : width;
  const contentWidth = availableWidth - (SIZES.padding * 2);
  const gridSpacing = 15;
  
  const idealMovieWidth = 115;
  const numColumns = Math.max(3, Math.floor((contentWidth + gridSpacing) / (idealMovieWidth + gridSpacing)));
  const itemWidth = Math.floor((contentWidth - (gridSpacing * (numColumns - 1))) / numColumns);
  
  const idealMixtapeWidth = isTabletOrWeb ? 220 : 160;
  const numMixtapeColumns = Math.max(2, Math.floor((contentWidth + gridSpacing) / (idealMixtapeWidth + gridSpacing)));
  const mixtapeWidth = Math.floor((contentWidth - (gridSpacing * (numMixtapeColumns - 1))) / numMixtapeColumns); 

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
                      setEditMixModalVisible(false);
                      setCreateMixModalVisible(false);
                      setShareModalVisible(false);
                  });
              } else {
                  Animated.spring(panY, { toValue: 0, useNativeDriver: true, bounciness: 4 }).start();
              }
          }
      })
  ).current;

  useEffect(() => {
      if (editMixModalVisible || createMixModalVisible || shareModalVisible) {
          panY.setValue(0);
      }
  }, [editMixModalVisible, createMixModalVisible, shareModalVisible, panY]);

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
      if (watchlist.length === 0) { setLatestUpdates([]); setLoadingLatest(false); return; }
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

  useEffect(() => { if (activeTab === 'latest') fetchLatestUpdates(); }, [activeTab, watchlist]);

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
          setMixTitleEdit(''); setMixDescEdit(''); setCreateMixModalVisible(false);
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

  const openShareOptions = (mix) => {
      if (!mix.items || mix.items.length === 0) {
          showAlert("Empty Mixtape", "Add some movies or shows before sharing!"); return;
      }
      setActiveShareMix(mix);
      setShareModalVisible(true);
  };

  const executeShare = async (shareType) => {
      const mix = activeShareMix;
      setShareModalVisible(false);
      setSharingId(mix.id);
      
      try {
          let publicId = null;
          try {
              publicId = await shareMixtape(mix.id, mix.title, mix.items, shareType === 'collab');
          } catch (backendErr) {
              console.warn("Collab flag not supported yet, falling back:", backendErr);
              publicId = await shareMixtape(mix.id, mix.title, mix.items);
          }
          
          if (publicId) {
              const urlPath = shareType === 'collab' ? 'collab' : 'mixtape';
              const shareUrl = `${APP_DOMAIN}/${urlPath}/${publicId}`;
              
              const actionText = shareType === 'collab' ? "Help me curate" : "Check out";
              const shareText = `${actionText} my Mixtape "${toTitleCase(mix.title)}" on ${APP_NAME}!\n\nTap here: ${shareUrl}`;
              
              if (Platform.OS === 'web') {
                  if (navigator.share) {
                      try { await navigator.share({ title: toTitleCase(mix.title), text: shareText, url: shareUrl }); } 
                      catch (err) {
                          if (err.name !== 'AbortError' && navigator.clipboard) {
                              await navigator.clipboard.writeText(shareText);
                              showAlert("Link Copied", "Link copied to clipboard!");
                          }
                      }
                  } else if (navigator.clipboard) {
                      await navigator.clipboard.writeText(shareText);
                      showAlert("Link Copied", "Link copied to clipboard!");
                  }
              } else {
                  // Removed 'url' parameter to prevent slow native link-preview fetching
                  await Share.share({ message: shareText, title: toTitleCase(mix.title) });
              }
          } else {
              showAlert("Error", "Failed to generate share link. Please try again.");
          }
      } catch (e) {
          console.error("Share error:", e);
          showAlert("Error", "An unexpected error occurred while sharing.");
      } finally {
          setSharingId(null);
      }
  };

  let displayData = [];
  if (activeTab === 'watchlist') displayData = watchlist;
  else if (activeTab === 'history') displayData = history;
  else if (activeTab === 'latest') displayData = latestUpdates;

  const renderPill = (id, label, icon) => {
    const isActive = activeTab === id;
    return (
      <TouchableOpacity 
        style={[styles.pillBtn, { backgroundColor: isActive ? (isDarkMode ? '#fff' : '#000') : (isDarkMode ? '#222' : '#e5e5e5') }]}
        onPress={() => { 
          LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
          setActiveTab(id); setTappedCardId(null); setActivePlaylistViewId(null);
        }}
        activeOpacity={0.8}
      >
        <Ionicons name={icon} size={16} color={isActive ? (isDarkMode ? '#000' : '#fff') : theme.text} style={{ marginRight: 8 }} />
        <Text style={[styles.pillText, { color: isActive ? (isDarkMode ? '#000' : '#fff') : theme.text, fontWeight: isActive ? 'bold' : '600' }]}>{label}</Text>
      </TouchableOpacity>
    );
  };

  const renderEmptyState = () => {
    let icon, title, subtitle;
    if (activeTab === 'watchlist') { icon = 'bookmark-outline'; title = 'Your watchlist is empty'; subtitle = 'Save movies and shows to watch later'; } 
    else if (activeTab === 'history') { icon = 'time-outline'; title = 'Your history is empty'; subtitle = 'Content you watch will appear here'; } 
    else if (activeTab === 'latest') { icon = 'notifications-outline'; title = 'No recent updates'; subtitle = 'Add active TV shows to your watchlist to see new episodes here'; } 
    else { icon = 'albums-outline'; title = 'No Mixtapes Yet'; subtitle = 'Create a custom mixtape from any movie details screen!'; }

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
      <Text style={[styles.mainTitle, { color: theme.text, fontSize: isTabletOrWeb ? 46 : 32 }]}>My Library</Text>
      <Text style={[styles.subTitle, { color: theme.textSecondary }]}>Your saved content</Text>
      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.pillsContainer}>
        {renderPill('watchlist', 'Watchlist', 'bookmark-outline')}
        {renderPill('mixtapes', 'Mixtapes', 'albums-outline')}
        {renderPill('history', 'History', 'time-outline')}
        {renderPill('latest', 'Latest', 'notifications-outline')}
      </ScrollView>
    </View>
  );

  return (
    <View style={[styles.container, { backgroundColor: theme.background, paddingTop: Math.max(insets.top, 20) }]}>
      
      {activeTab === 'mixtapes' && activePlaylistViewId ? (
          (() => {
              const activeMix = mixtapes.find(m => m.id === activePlaylistViewId);
              if (!activeMix) {
                  setActivePlaylistViewId(null); return null;
              }
              return (
                 <FlatList
                    key="mixView-List" data={activeMix.items} extraData={activeMix.items} keyExtractor={(item) => item.id.toString()}
                    showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingHorizontal: SIZES.padding, paddingBottom: 100 }}
                    onScrollBeginDrag={() => setTappedCardId(null)}
                    ListHeaderComponent={
                        <View style={[{ marginBottom: isTabletOrWeb ? 50 : 30 }, isTabletOrWeb && styles.desktopHeaderWrapper]}>
                            <TouchableOpacity onPress={() => setActivePlaylistViewId(null)} style={{ alignSelf: 'flex-start', padding: 5, marginBottom: isTabletOrWeb ? 20 : 15 }}>
                                <Ionicons name="chevron-back" size={28} color={theme.text} />
                            </TouchableOpacity>
                            <View style={isTabletOrWeb ? styles.desktopHeaderRow : styles.mobileHeaderCol}>
                                <View style={[isTabletOrWeb ? styles.desktopCover : styles.mobileCover, { shadowColor: '#000' }]}>
                                    <MixtapeCover mixtape={activeMix} theme={theme} />
                                </View>
                                <View style={isTabletOrWeb ? styles.desktopDetails : styles.mobileDetails}>
                                    <Text style={{ color: theme.textSecondary, fontSize: isTabletOrWeb ? 16 : 14, fontWeight: 'bold', textTransform: 'uppercase', letterSpacing: 1 }}>Mixtape</Text>
                                    <Text style={{ color: theme.text, fontSize: isTabletOrWeb ? 64 : 32, fontWeight: '900', textAlign: isTabletOrWeb ? 'left' : 'center', lineHeight: isTabletOrWeb ? 70 : 36, marginTop: 4, marginBottom: 10 }} numberOfLines={2}>{toTitleCase(activeMix.title)}</Text>
                                    <CollabAvatars mixtape={activeMix} theme={theme} currentUserUid={user?.uid} activeProfile={activeProfile} activeProfileKey={activeProfileKey} />
                                    <Text style={{ color: theme.textSecondary, fontSize: isTabletOrWeb ? 16 : 14, marginBottom: 12, textAlign: isTabletOrWeb ? 'left' : 'center' }}>Contains {activeMix.items.length} item{activeMix.items.length !== 1 ? 's' : ''}</Text>
                                    {activeMix.description ? (<Text style={{ color: theme.textSecondary, fontSize: isTabletOrWeb ? 16 : 14, textAlign: isTabletOrWeb ? 'left' : 'center', maxWidth: isTabletOrWeb ? 600 : 300 }}>{activeMix.description}</Text>) : null}
                                    
                                    <View style={[styles.iconActionRow, { justifyContent: isTabletOrWeb ? 'flex-start' : 'center', width: '100%', marginTop: 25 }]}>
                                        <TouchableOpacity style={styles.iconActionItem} onPress={() => openMixEditor(activeMix)} activeOpacity={0.7}>
                                            <View style={[styles.actionCircle, { backgroundColor: theme.surfaceGlass, borderColor: theme.border }]}><Ionicons name="pencil-outline" size={isTabletOrWeb ? 26 : 24} color={theme.text} /></View>
                                            <Text style={[styles.iconActionText, { color: theme.textSecondary, fontSize: isTabletOrWeb ? 14 : 12 }]}>Edit</Text>
                                        </TouchableOpacity>
                                        <TouchableOpacity style={styles.iconActionItem} onPress={() => openShareOptions(activeMix)} activeOpacity={0.7} disabled={sharingId === activeMix.id}>
                                            <View style={[styles.actionCircle, { backgroundColor: theme.surfaceGlass, borderColor: theme.border }]}>
                                                {sharingId === activeMix.id ? (<ActivityIndicator size="small" color={theme.text} />) : (<Ionicons name="paper-plane-outline" size={isTabletOrWeb ? 26 : 24} color={theme.text} style={{ marginLeft: 2 }} />)}
                                            </View>
                                            <Text style={[styles.iconActionText, { color: theme.textSecondary, fontSize: isTabletOrWeb ? 14 : 12 }]}>Share</Text>
                                        </TouchableOpacity>
                                    </View>
                                </View>
                            </View>
                        </View>
                    }
                    ListEmptyComponent={<View style={{ alignItems: 'center', marginTop: 30 }}><Ionicons name="film-outline" size={50} color={theme.textSecondary} style={{ opacity: 0.5 }} /><Text style={{ color: theme.textSecondary, marginTop: 10 }}>No items in this mixtape yet.</Text></View>}
                    renderItem={({ item, index }) => {
                        const rawType = item.media_type || item.type || item.mediaType;
                        const mediaType = rawType ? String(rawType).toLowerCase() : (item.name || item.first_air_date ? 'tv' : 'movie');
                        const isOwner = item.addedByProfileKey ? (item.addedByProfileKey === activeProfileKey) : (user && item.addedByUid === user.uid);
                        return (
                            <TouchableOpacity style={[styles.trackRow, { borderBottomColor: theme.border }]} activeOpacity={0.7} onPress={() => navigation.navigate('Details', { id: item.id, type: mediaType })}>
                                <Text style={[styles.trackIndex, { color: theme.textSecondary }]}>{index + 1}</Text>
                                <View style={styles.trackPosterWrap}>
                                    {item.poster_path ? (<Image source={{ uri: `${IMG_BASE}${item.poster_path}` }} style={[styles.trackPoster, { borderColor: theme.border }]} />) : (<View style={[styles.trackPoster, { backgroundColor: theme.surface, borderColor: theme.border, justifyContent: 'center', alignItems: 'center' }]}><Ionicons name="film-outline" size={18} color={theme.textSecondary} /></View>)}
                                </View>
                                <View style={styles.trackMeta}>
                                    <Text style={[styles.trackTitle, { color: theme.text }]} numberOfLines={1}>{item.title || item.name}</Text>
                                    <Text style={[styles.trackType, { color: theme.textSecondary, marginBottom: 4 }]}>{mediaType === 'movie' ? 'Movie' : 'TV Series'}</Text>
                                    {item.addedByName && (
                                        <View style={[styles.attributionPill, { backgroundColor: theme.surface, borderColor: theme.border }]}>
                                            {item.addedByPic ? (<Image source={{ uri: item.addedByPic }} style={styles.attributionAvatar} />) : (<View style={[styles.attributionAvatarFallback, { backgroundColor: item.addedByColor || theme.primary }]}><Text style={{ color: '#fff', fontSize: 8, fontWeight: 'bold' }}>{item.addedByName ? item.addedByName.charAt(0).toUpperCase() : '?'}</Text></View>)}
                                            <Text style={[styles.attributionName, { color: theme.textSecondary }]} numberOfLines={1}>{isOwner ? 'Added by You' : `Added by ${item.addedByName}`}</Text>
                                        </View>
                                    )}
                                </View>
                                <TouchableOpacity style={{ padding: 8 }} onPress={() => toggleInMixtape(activeMix.id, item)}><Ionicons name="trash-outline" size={20} color="#e51c23" /></TouchableOpacity>
                            </TouchableOpacity>
                        );
                    }}
                 />
              );
          })()
      ) : activeTab === 'latest' && loadingLatest ? (
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
                        <Text style={{ color: theme.text, fontWeight: 'bold', fontSize: 16, marginTop: 10 }} numberOfLines={1}>{toTitleCase(item.title)}</Text>
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
            <LibraryCard item={item} itemWidth={itemWidth} theme={theme} navigateToDetails={navigateToDetails} tappedCardId={tappedCardId} setTappedCardId={setTappedCardId} isHistory={activeTab === 'history'} />
          )}
        />
      )}

      {/* EDIT MIXTAPE MODAL WITH SAFE LEAVE LOGIC */}
      <Modal visible={editMixModalVisible} transparent animationType="slide">
        <KeyboardWrapper behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={isTabletOrWeb ? styles.desktopModalOverlay : styles.bottomSheetOverlay}>
           <TouchableOpacity style={StyleSheet.absoluteFill} activeOpacity={1} onPress={() => setEditMixModalVisible(false)} />
           <Animated.View style={[isTabletOrWeb ? styles.desktopModalContainer : styles.bottomSheetContainer, { backgroundColor: theme.background, borderColor: theme.border }, !isTabletOrWeb && { transform: [{ translateY: panY }] }]}>
             <View {...(!isTabletOrWeb ? panResponder.panHandlers : {})} style={{ backgroundColor: 'transparent', paddingTop: 10, paddingBottom: 10 }}>
                 {!isTabletOrWeb && <View style={styles.bottomSheetHandle} />}
                 <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 }}>
                     <Text style={[styles.bottomSheetTitle, { color: theme.text, marginBottom: 0 }]}>Edit Mixtape</Text>
                     {isTabletOrWeb && (<TouchableOpacity onPress={() => setEditMixModalVisible(false)} hitSlop={{top:10, bottom:10, left:10, right:10}}><Ionicons name="close-circle" size={28} color={theme.textSecondary} /></TouchableOpacity>)}
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
                        {/* Dynamic Leave/Delete Button Logic */}
                        <TouchableOpacity 
                            style={[styles.actionBtn, { backgroundColor: 'rgba(229, 28, 35, 0.15)' }]} 
                            onPress={() => { 
                                if (isCollaboratorOnly) leaveCollaborativeMixtape(activeEditMix.id);
                                else deleteMixtape(activeEditMix.id); 
                                
                                setEditMixModalVisible(false); 
                                setActivePlaylistViewId(null); 
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

      {/* CREATE NEW MODAL */}
      <Modal visible={createMixModalVisible} transparent animationType="slide">
        <KeyboardWrapper behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={isTabletOrWeb ? styles.desktopModalOverlay : styles.bottomSheetOverlay}>
           <TouchableOpacity style={StyleSheet.absoluteFill} activeOpacity={1} onPress={() => setCreateMixModalVisible(false)} />
           <Animated.View style={[isTabletOrWeb ? styles.desktopModalContainer : styles.bottomSheetContainer, { backgroundColor: theme.background, borderColor: theme.border }, !isTabletOrWeb && { transform: [{ translateY: panY }] }]}>
             <View {...(!isTabletOrWeb ? panResponder.panHandlers : {})} style={{ backgroundColor: 'transparent', paddingTop: 10, paddingBottom: 10 }}>
                 {!isTabletOrWeb && <View style={styles.bottomSheetHandle} />}
                 <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 }}>
                     <Text style={[styles.bottomSheetTitle, { color: theme.text, marginBottom: 0 }]}>Create New Mixtape</Text>
                     {isTabletOrWeb && (<TouchableOpacity onPress={() => setCreateMixModalVisible(false)} hitSlop={{top:10, bottom:10, left:10, right:10}}><Ionicons name="close-circle" size={28} color={theme.textSecondary} /></TouchableOpacity>)}
                 </View>
             </View>
             <Text style={[styles.inputLabel, { color: theme.textSecondary }]}>MIXTAPE TITLE</Text>
             <TextInput style={[styles.mixInput, { backgroundColor: theme.surface, color: theme.text, borderColor: theme.border, marginBottom: 15 }]} value={mixTitleEdit} onChangeText={setMixTitleEdit} autoFocus />
             <Text style={[styles.inputLabel, { color: theme.textSecondary }]}>DESCRIPTION (OPTIONAL)</Text>
             <TextInput style={[styles.mixInputDesc, { backgroundColor: theme.surface, color: theme.text, borderColor: theme.border, marginBottom: 20 }]} value={mixDescEdit} onChangeText={setMixDescEdit} multiline />
             <View style={{ flexDirection: 'row', gap: 10 }}>
                <TouchableOpacity style={[styles.actionBtn, { backgroundColor: theme.surfaceGlass }]} onPress={() => setCreateMixModalVisible(false)}><Text style={{ color: theme.text, fontWeight: 'bold', fontSize: 16 }}>Cancel</Text></TouchableOpacity>
                <TouchableOpacity style={[styles.actionBtn, { backgroundColor: mixTitleEdit.trim() ? theme.primary : theme.surfaceGlass }]} disabled={!mixTitleEdit.trim()} onPress={handleCreateMixtape}><Text style={{ color: mixTitleEdit.trim() ? '#fff' : theme.textSecondary, fontWeight: 'bold', fontSize: 16 }}>Create</Text></TouchableOpacity>
             </View>
           </Animated.View>
        </KeyboardWrapper>
      </Modal>

      {/* SHARE OPTIONS MODAL */}
      <Modal visible={shareModalVisible} transparent animationType="slide">
        <KeyboardWrapper behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={isTabletOrWeb ? styles.desktopModalOverlay : styles.bottomSheetOverlay}>
           <TouchableOpacity style={StyleSheet.absoluteFill} activeOpacity={1} onPress={() => setShareModalVisible(false)} />
           <Animated.View style={[isTabletOrWeb ? styles.desktopModalContainer : styles.bottomSheetContainer, { backgroundColor: theme.background, borderColor: theme.border }, !isTabletOrWeb && { transform: [{ translateY: panY }] }]}>
             <View {...(!isTabletOrWeb ? panResponder.panHandlers : {})} style={{ backgroundColor: 'transparent', paddingTop: 10, paddingBottom: 10 }}>
                 {!isTabletOrWeb && <View style={styles.bottomSheetHandle} />}
                 <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 }}>
                     <Text style={[styles.bottomSheetTitle, { color: theme.text, marginBottom: 0 }]}>Share Options</Text>
                     {isTabletOrWeb && (<TouchableOpacity onPress={() => setShareModalVisible(false)} hitSlop={{top:10, bottom:10, left:10, right:10}}><Ionicons name="close-circle" size={28} color={theme.textSecondary} /></TouchableOpacity>)}
                 </View>
             </View>
             <Text style={{ color: theme.textSecondary, marginBottom: 25, fontSize: 14 }}>How would you like to share "{activeShareMix?.title}"?</Text>
             <TouchableOpacity style={[styles.shareOptionCard, { backgroundColor: theme.surfaceGlass, borderColor: theme.border }]} activeOpacity={0.7} onPress={() => executeShare('watch')}>
                <View style={[styles.shareIconContainer, { backgroundColor: 'rgba(0, 114, 237, 0.15)' }]}><Ionicons name="film-outline" size={24} color="#0072ed" /></View>
                <View style={{ flex: 1 }}>
                    <Text style={[styles.shareOptionTitle, { color: theme.text }]}>Share to Watch</Text>
                    <Text style={[styles.shareOptionSub, { color: theme.textSecondary }]}>Friends can view and save a copy of this mixtape.</Text>
                </View>
                <Ionicons name="chevron-forward" size={20} color={theme.textSecondary} />
             </TouchableOpacity>
             <TouchableOpacity style={[styles.shareOptionCard, { backgroundColor: theme.surfaceGlass, borderColor: theme.border }]} activeOpacity={0.7} onPress={() => executeShare('collab')}>
                <View style={[styles.shareIconContainer, { backgroundColor: 'rgba(106, 231, 14, 0.15)' }]}><Ionicons name="people-outline" size={24} color="#6ae70e" /></View>
                <View style={{ flex: 1 }}>
                    <Text style={[styles.shareOptionTitle, { color: theme.text }]}>Invite Collaborators</Text>
                    <Text style={[styles.shareOptionSub, { color: theme.textSecondary }]}>Friends can join, add, and remove tracks in real-time.</Text>
                </View>
                <Ionicons name="chevron-forward" size={20} color={theme.textSecondary} />
             </TouchableOpacity>
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
  loadingContainer: { flex: 1, justifyContent: 'center', alignItems: 'center', paddingBottom: 100 },

  desktopHeaderWrapper: { paddingBottom: 20 },
  desktopHeaderRow: { flexDirection: 'row', alignItems: 'flex-end', gap: 40 },
  desktopCover: { width: 250, height: 250, shadowOffset: { width: 0, height: 15 }, shadowOpacity: 0.4, shadowRadius: 20 },
  desktopDetails: { flex: 1, justifyContent: 'flex-end' },
  
  mobileHeaderCol: { flexDirection: 'column', alignItems: 'center', gap: 20 },
  mobileCover: { width: 180, height: 180, shadowOffset: { width: 0, height: 10 }, shadowOpacity: 0.3, shadowRadius: 15 },
  mobileDetails: { width: '100%', alignItems: 'center' },

  iconActionRow: { flexDirection: 'row', gap: 35 },
  iconActionItem: { alignItems: 'center', justifyContent: 'center' },
  actionCircle: { width: 56, height: 56, borderRadius: 28, justifyContent: 'center', alignItems: 'center', marginBottom: 8, borderWidth: 1 },
  iconActionText: { fontWeight: '600' },

  mainTitle: { fontWeight: '900', marginBottom: 5 },
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
  
  desktopModalOverlay: { flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: 'rgba(0,0,0,0.7)' },
  desktopModalContainer: { width: 500, maxWidth: '90%', maxHeight: '85%', borderRadius: 24, padding: 24, borderWidth: 1, shadowColor: '#000', shadowOffset: { width: 0, height: 10 }, shadowOpacity: 0.3, shadowRadius: 20 },

  bottomSheetHandle: { width: 40, height: 5, backgroundColor: 'rgba(150,150,150,0.5)', borderRadius: 3, alignSelf: 'center', marginBottom: 20 },
  bottomSheetTitle: { fontSize: 20, fontWeight: 'bold', marginBottom: 5 }, 
  
  inputLabel: { fontSize: 11, fontWeight: 'bold', textTransform: 'uppercase', letterSpacing: 1, marginBottom: 8, marginLeft: 4 },
  mixInput: { height: 50, borderWidth: 1, borderRadius: 12, paddingHorizontal: 15, fontSize: 16 },
  mixInputDesc: { height: 80, borderWidth: 1, borderRadius: 12, paddingHorizontal: 15, paddingTop: 12, fontSize: 14, textAlignVertical: 'top' },
  stylePill: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 16, paddingVertical: 10, borderRadius: 20, borderWidth: 1 },
  actionBtn: { flex: 1, paddingVertical: 14, borderRadius: 8, alignItems: 'center' },

  shareOptionCard: { flexDirection: 'row', alignItems: 'center', padding: 15, borderRadius: 16, borderWidth: 1, marginBottom: 15 },
  shareIconContainer: { width: 46, height: 46, borderRadius: 23, justifyContent: 'center', alignItems: 'center', marginRight: 15 },
  shareOptionTitle: { fontSize: 16, fontWeight: 'bold', marginBottom: 4 },
  shareOptionSub: { fontSize: 13, lineHeight: 18 },

  trackRow: { flexDirection: 'row', alignItems: 'center', paddingVertical: 12, borderBottomWidth: StyleSheet.hairlineWidth },
  trackIndex: { fontSize: 15, width: 30, fontWeight: '600', textAlign: 'center' },
  trackPosterWrap: { width: 45, height: 68, marginRight: 14, borderRadius: 6, overflow: 'hidden' },
  trackPoster: { width: '100%', height: '100%', borderWidth: 1, borderRadius: 6, resizeMode: 'cover' },
  trackMeta: { flex: 1, justifyContent: 'center' },
  trackTitle: { fontSize: 15, fontWeight: 'bold', marginBottom: 3 },
  trackType: { fontSize: 12 },

  stackAvatar: { width: 32, height: 32, borderRadius: 16, borderWidth: 2 },
  
  attributionPill: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 6, paddingVertical: 3, borderRadius: 12, borderWidth: 1, alignSelf: 'flex-start', gap: 5 },
  attributionAvatar: { width: 14, height: 14, borderRadius: 7 },
  attributionAvatarFallback: { width: 14, height: 14, borderRadius: 7, justifyContent: 'center', alignItems: 'center' },
  attributionName: { fontSize: 10, fontWeight: '500' },

  alertOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.7)', justifyContent: 'center', alignItems: 'center', padding: 20 },
  alertCard: { width: '100%', maxWidth: 320, borderRadius: 16, padding: 20, borderWidth: 1, alignItems: 'center' },
  alertTitle: { fontSize: 18, fontWeight: 'bold', marginBottom: 10, textAlign: 'center' },
  alertMessage: { fontSize: 14, textAlign: 'center', marginBottom: 20 },
  alertButton: { paddingVertical: 12, paddingHorizontal: 30, borderRadius: 25 },
  alertButtonText: { color: '#fff', fontWeight: 'bold', fontSize: 16 }
});