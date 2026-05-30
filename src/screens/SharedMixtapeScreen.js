// src/screens/SharedMixtapeScreen.js
import React, { useState, useEffect, useContext, useRef, useCallback } from 'react';
import {
  View, Text, StyleSheet, FlatList, TouchableOpacity,
  ActivityIndicator, Image, Alert, useWindowDimensions, Platform, Animated
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { ThemeContext } from '../context/ThemeContext';
import { LibraryContext } from '../context/LibraryContext';
import { AuthContext } from '../context/AuthContext';
import { SIZES } from '../constants/theme';

const IMG_BASE = "https://image.tmdb.org/t/p/w342";

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
        <Text style={{ color: '#fff', fontWeight: '900', fontSize: 18, textAlign: 'center', alignSelf: 'center', marginTop: 'auto', marginBottom: 'auto', paddingHorizontal: 10 }} numberOfLines={2}>
          {toTitleCase(mixtape.title || mixtape.name)}
        </Text>
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

// --- NEW COMPONENT: Spotify-style Collaborator Stack ---
const CollabAvatars = ({ mixtape, theme, currentUserUid }) => {
  const collabs = mixtape.collaborators || [];
  const creatorName = mixtape.creatorName || mixtape.ownerName || 'Unknown Curator';

  if (!collabs || collabs.length === 0) {
      const profilePic = mixtape.creatorImage || mixtape.ownerImage || mixtape.creatorProfilePic;
      return (
          <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 12 }}>
              {profilePic ? (
                  <Image source={{ uri: profilePic }} style={{ width: 28, height: 28, borderRadius: 14, marginRight: 8, borderWidth: 1, borderColor: theme.border }} />
              ) : (
                  <Ionicons name="person-circle" size={28} color={theme.textSecondary} style={{ marginRight: 6 }} />
              )}
              <Text style={{ color: theme.text, fontWeight: '600', fontSize: 16 }}>
                  {creatorName}
              </Text>
          </View>
      );
  }

  // Sort to put the current user at the front of the stack
  const sortedCollabs = [...collabs].sort((a, b) => {
      if (a.uid === currentUserUid) return -1;
      if (b.uid === currentUserUid) return 1;
      return 0;
  });

  const maxVisible = 4;
  const avatars = sortedCollabs.slice(0, maxVisible);
  const extra = collabs.length > maxVisible ? collabs.length - maxVisible : 0;

  let displayString = creatorName;
  if (extra > 0) displayString += ` + ${extra} others`;

  return (
      <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 15 }}>
          <View style={{ flexDirection: 'row', marginRight: 10 }}>
              {avatars.map((c, index) => (
                  <Image
                      key={c.uid || index}
                      source={{ uri: c.pic || 'https://via.placeholder.com/150' }}
                      style={[styles.stackAvatar, {
                          borderColor: theme.background,
                          backgroundColor: theme.surface,
                          marginLeft: index > 0 ? -12 : 0,
                          zIndex: maxVisible - index
                      }]}
                  />
              ))}
          </View>
          <Text style={{ color: theme.text, fontWeight: '600', fontSize: 16 }}>
              {displayString}
          </Text>
      </View>
  );
};

export default function SharedMixtapeScreen({ navigation, route }) {
  const { mixtapeId, isCollab: routeIsCollab } = route.params || {};

  const { theme } = useContext(ThemeContext);
  const { user, isGuest } = useContext(AuthContext);
  const { fetchPublicMixtape, savePublicMixtape, joinCollaborativeMixtape, mixtapes } = useContext(LibraryContext);
  const insets = useSafeAreaInsets();

  const { width, height } = useWindowDimensions();
  const isTabletOrWeb = width >= 768;

  const [mixtape, setMixtape] = useState(null);
  const [loading, setLoading] = useState(true);
  const [isActioning, setIsActioning] = useState(false);

  const pulseAnim = useRef(new Animated.Value(1)).current;
  useEffect(() => {
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(pulseAnim, { toValue: 1.4, duration: 700, useNativeDriver: true }),
        Animated.timing(pulseAnim, { toValue: 1,   duration: 700, useNativeDriver: true }),
      ])
    );
    loop.start();
    return () => loop.stop();
  }, []);

  // Belt-and-suspenders: routeIsCollab takes precedence if it was explicitly passed during navigation
  const isCollabMixtape = typeof routeIsCollab === 'boolean' 
    ? routeIsCollab 
    : (mixtape?.isCollaborative === true);

  const isAlreadyJoined = mixtapes.some(
    (m) => (m.id === mixtapeId || m.sharedPublicId === mixtapeId) && m.isCollaborative
  );
  const isAlreadySaved = mixtapes.some(
    (m) => m.id === mixtapeId || m.sharedPublicId === mixtapeId || m.originalId === mixtapeId || m.watchSharedId === mixtapeId
  );

  useEffect(() => {
    if (!mixtapeId) { setLoading(false); return; }
    fetchPublicMixtape(mixtapeId).then((data) => {
      setMixtape(data);
      setLoading(false);
    });
  }, [mixtapeId]);

  const handleBack = useCallback(() => {
    if (navigation.canGoBack()) navigation.goBack();
    else navigation.navigate('Home');
  }, [navigation]);

  const handleJoinCollab = async () => {
    if (!user || isGuest) {
      Alert.alert('Sign In Required', 'You need to be signed in to join a collaborative mixtape.');
      return;
    }
    if (isAlreadyJoined) {
      navigation.navigate('MainTabs', { screen: 'Library', params: { viewMixtapeId: mixtapeId } });
      return;
    }
    setIsActioning(true);
    const success = await joinCollaborativeMixtape(mixtapeId);
    setIsActioning(false);
    if (success) {
      navigation.navigate('MainTabs', { screen: 'Library', params: { viewMixtapeId: mixtapeId } });
    } else {
      Alert.alert('Could Not Join', 'Failed to join this mixtape. Please try again.');
    }
  };

  const handleSaveCopy = async () => {
    if (isAlreadySaved) {
      Alert.alert('Already Saved', 'This mixtape is already in your library.');
      return;
    }
    setIsActioning(true);
    const success = await savePublicMixtape(mixtapeId);
    setIsActioning(false);
    if (success) {
      Alert.alert('Saved!', 'A copy has been added to your library.');
      navigation.navigate('MainTabs', { screen: 'Library', params: { viewMixtapeId: mixtapeId } });
    } else {
      Alert.alert('Error', 'Failed to save this mixtape. Please try again.');
    }
  };

  const renderTrack = ({ item, index }) => {
    const rawType = item.media_type || item.type || item.mediaType;
    const mediaType = rawType ? String(rawType).toLowerCase() : (item.name || item.first_air_date ? 'tv' : 'movie');
    const isOwner = user && item.addedByUid === user.uid;

    return (
      <TouchableOpacity
        style={[styles.trackRow, { borderBottomColor: theme.border }]}
        activeOpacity={0.7}
        onPress={() => navigation.navigate('Details', { id: item.id, type: mediaType })}
      >
        <Text style={[styles.trackIndex, { color: theme.textSecondary }]}>{index + 1}</Text>

        <View style={styles.trackPosterWrap}>
          {item.poster_path ? (
            <Image source={{ uri: `${IMG_BASE}${item.poster_path}` }} style={[styles.trackPoster, { borderColor: theme.border }]} />
          ) : (
            <View style={[styles.trackPoster, { backgroundColor: theme.surface, borderColor: theme.border, justifyContent: 'center', alignItems: 'center' }]}>
              <Ionicons name="film-outline" size={18} color={theme.textSecondary} />
            </View>
          )}
        </View>

        <View style={styles.trackMeta}>
          <Text style={[styles.trackTitle, { color: theme.text }]} numberOfLines={1}>{item.title || item.name}</Text>
          <Text style={[styles.trackType, { color: theme.textSecondary, marginBottom: 4 }]}>
            {mediaType === 'movie' ? 'Movie' : 'TV Series'}
          </Text>

          {isCollabMixtape && item.addedByName && (
            <View style={[styles.attributionPill, { backgroundColor: theme.surface, borderColor: theme.border }]}>
              {item.addedByPic ? (
                <Image source={{ uri: item.addedByPic }} style={styles.attributionAvatar} />
              ) : (
                <View style={[styles.attributionAvatarFallback, { backgroundColor: theme.background }]}>
                  <Ionicons name="person" size={8} color={theme.textSecondary} />
                </View>
              )}
              <Text style={[styles.attributionName, { color: theme.textSecondary }]} numberOfLines={1}>
                {isOwner ? 'Added by You' : `Added by ${item.addedByName}`}
              </Text>
            </View>
          )}
        </View>

        <Ionicons name="chevron-forward" size={18} color={theme.textSecondary} />
      </TouchableOpacity>
    );
  };

  if (loading) {
    return (
      <View style={[styles.centered, { backgroundColor: theme.background }]}>
        <ActivityIndicator size="large" color={theme.primary} />
        <Text style={{ color: theme.textSecondary, marginTop: 12, fontSize: 14 }}>Loading mixtape…</Text>
      </View>
    );
  }

  if (!mixtape) {
    return (
      <View style={[styles.centered, { backgroundColor: theme.background }]}>
        <View style={{ width: 80, height: 80, borderRadius: 40, backgroundColor: theme.surface, justifyContent: 'center', alignItems: 'center', marginBottom: 20 }}>
          <Ionicons name="alert-circle-outline" size={44} color={theme.textSecondary} />
        </View>
        <Text style={{ color: theme.text, fontSize: 20, fontWeight: '900', marginBottom: 8 }}>Not Found</Text>
        <Text style={{ color: theme.textSecondary, fontSize: 14, textAlign: 'center', maxWidth: 260, lineHeight: 20 }}>
          This mixtape is private, deleted, or the link may be invalid.
        </Text>
        <TouchableOpacity style={[styles.outlineBtn, { borderColor: theme.border, marginTop: 28 }]} onPress={handleBack}>
          <Ionicons name="chevron-back" size={16} color={theme.text} style={{ marginRight: 6 }} />
          <Text style={{ color: theme.text, fontWeight: 'bold' }}>Go Back</Text>
        </TouchableOpacity>
      </View>
    );
  }

  const itemCount = mixtape.items?.length || 0;
  const ctaAlreadyDone = isCollabMixtape ? isAlreadyJoined : isAlreadySaved;
  const ctaLabel = isCollabMixtape ? (isAlreadyJoined ? 'Joined' : 'Join Collaboration') : (isAlreadySaved  ? 'Saved to Library' : 'Save a Copy');
  const ctaIcon = isCollabMixtape ? (isAlreadyJoined ? 'checkmark-circle' : 'people') : (isAlreadySaved  ? 'checkmark-circle' : 'copy-outline');
  const ctaColor = isCollabMixtape ? '#6ae70e' : theme.primary;
  const ctaHandler = isCollabMixtape ? handleJoinCollab : handleSaveCopy;

  const ListHeader = (
    <View style={[{ marginBottom: isTabletOrWeb ? 50 : 30 }, isTabletOrWeb && styles.desktopHeaderWrapper]}>
      <TouchableOpacity onPress={handleBack} style={{ alignSelf: 'flex-start', padding: 5, marginBottom: isTabletOrWeb ? 20 : 15 }}>
        <Ionicons name="chevron-back" size={28} color={theme.text} />
      </TouchableOpacity>

      <View style={isTabletOrWeb ? styles.desktopHeaderRow : styles.mobileHeaderCol}>
        <View style={[isTabletOrWeb ? styles.desktopCover : styles.mobileCover, { shadowColor: '#000' }]}>
          <MixtapeCover mixtape={mixtape} theme={theme} />
          {isCollabMixtape && (
            <View style={styles.collabCoverBadge}>
              <Animated.View style={[styles.liveDot, { transform: [{ scale: pulseAnim }] }]} />
              <Text style={styles.collabBadgeText}>LIVE COLLAB</Text>
            </View>
          )}
        </View>

        <View style={isTabletOrWeb ? styles.desktopDetails : styles.mobileDetails}>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 4, flexWrap: 'wrap', justifyContent: isTabletOrWeb ? 'flex-start' : 'center' }}>
            <Text style={{ color: theme.textSecondary, fontSize: isTabletOrWeb ? 16 : 13, fontWeight: 'bold', textTransform: 'uppercase', letterSpacing: 1 }}>
              {isCollabMixtape ? 'Collaborative Mixtape' : 'Shared Mixtape'}
            </Text>
            {isCollabMixtape && (
              <View style={[styles.livePill, { borderColor: '#6ae70e' }]}>
                <Animated.View style={[styles.liveDot, { transform: [{ scale: pulseAnim }] }]} />
                <Text style={[styles.livePillText, { color: '#6ae70e' }]}>LIVE</Text>
              </View>
            )}
          </View>

          <Text
            style={{ color: theme.text, fontSize: isTabletOrWeb ? 64 : 32, fontWeight: '900', textAlign: isTabletOrWeb ? 'left' : 'center', lineHeight: isTabletOrWeb ? 70 : 36, marginTop: 4, marginBottom: 15 }}
            numberOfLines={2}
          >
            {toTitleCase(mixtape.title || mixtape.name)}
          </Text>

          {/* New Avatar Stack Header */}
          <CollabAvatars mixtape={mixtape} theme={theme} currentUserUid={user?.uid} />
          
          <Text style={{ color: theme.textSecondary, fontSize: isTabletOrWeb ? 16 : 14, marginBottom: 12, textAlign: isTabletOrWeb ? 'left' : 'center' }}>
             Contains {itemCount} item{itemCount !== 1 ? 's' : ''}
          </Text>

          {mixtape.description ? (
            <Text style={{ color: theme.textSecondary, fontSize: isTabletOrWeb ? 16 : 14, textAlign: isTabletOrWeb ? 'left' : 'center', maxWidth: isTabletOrWeb ? 600 : 300, lineHeight: 22, marginBottom: 4 }}>
              {mixtape.description}
            </Text>
          ) : null}

          <View style={[styles.iconActionRow, { justifyContent: isTabletOrWeb ? 'flex-start' : 'center', marginTop: 25 }]}>
            <TouchableOpacity style={styles.iconActionItem} onPress={ctaHandler} disabled={isActioning || ctaAlreadyDone} activeOpacity={0.7}>
              <View style={[
                styles.actionCircle,
                {
                  backgroundColor: ctaAlreadyDone ? theme.surfaceGlass : isCollabMixtape ? 'rgba(106,231,14,0.15)' : `${theme.primary}22`,
                  borderColor: ctaAlreadyDone ? theme.border : ctaColor,
                }
              ]}>
                {isActioning ? (
                  <ActivityIndicator size="small" color={ctaColor} />
                ) : (
                  <Ionicons name={ctaIcon} size={isTabletOrWeb ? 26 : 24} color={ctaAlreadyDone ? theme.textSecondary : ctaColor} />
                )}
              </View>
              <Text style={[styles.iconActionText, { color: ctaAlreadyDone ? theme.textSecondary : ctaColor, fontSize: isTabletOrWeb ? 14 : 12 }]}>
                {ctaLabel}
              </Text>
            </TouchableOpacity>
          </View>

        </View>
      </View>
    </View>
  );

  return (
    <View style={[styles.container, { backgroundColor: theme.background, paddingTop: Math.max(insets.top, 20) }]}>
      <FlatList
        data={mixtape.items || []}
        keyExtractor={(item, index) => item.id?.toString() || index.toString()}
        showsVerticalScrollIndicator={false}
        contentContainerStyle={{ paddingHorizontal: SIZES.padding, paddingBottom: 100 }}
        ListHeaderComponent={ListHeader}
        ListEmptyComponent={
          <View style={{ alignItems: 'center', marginTop: 30, opacity: 0.5 }}>
            <Ionicons name="film-outline" size={50} color={theme.textSecondary} />
            <Text style={{ color: theme.textSecondary, marginTop: 10, fontSize: 14 }}>No items in this mixtape yet.</Text>
          </View>
        }
        renderItem={renderTrack}
        removeClippedSubviews={false}
        initialNumToRender={20}
        maxToRenderPerBatch={10}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  centered: { flex: 1, justifyContent: 'center', alignItems: 'center', padding: SIZES.padding },

  desktopHeaderWrapper: { paddingBottom: 20 },
  desktopHeaderRow: { flexDirection: 'row', alignItems: 'flex-end', gap: 40 },
  desktopCover: { width: 250, height: 250, shadowOffset: { width: 0, height: 15 }, shadowOpacity: 0.4, shadowRadius: 20 },
  desktopDetails: { flex: 1, justifyContent: 'flex-end' },
  mobileHeaderCol: { flexDirection: 'column', alignItems: 'center', gap: 20 },
  mobileCover: { width: 180, height: 180, shadowOffset: { width: 0, height: 10 }, shadowOpacity: 0.3, shadowRadius: 15 },
  mobileDetails: { width: '100%', alignItems: 'center' },

  iconActionRow: { flexDirection: 'row', gap: 35, width: '100%' },
  iconActionItem: { alignItems: 'center', justifyContent: 'center' },
  actionCircle: { width: 56, height: 56, borderRadius: 28, justifyContent: 'center', alignItems: 'center', marginBottom: 8, borderWidth: 1 },
  iconActionText: { fontWeight: '600', textAlign: 'center' },

  mixCoverBase: { width: '100%', aspectRatio: 1, borderRadius: 12, borderWidth: 1, flexWrap: 'wrap', flexDirection: 'row', overflow: 'hidden' },

  collabCoverBadge: { position: 'absolute', bottom: 10, left: 10, flexDirection: 'row', alignItems: 'center', backgroundColor: 'rgba(0,0,0,0.72)', paddingHorizontal: 10, paddingVertical: 5, borderRadius: 20, gap: 6 },
  liveDot: { width: 7, height: 7, borderRadius: 4, backgroundColor: '#6ae70e' },
  collabBadgeText: { color: '#6ae70e', fontSize: 10, fontWeight: '900', letterSpacing: 0.8 },
  livePill: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 8, paddingVertical: 3, borderRadius: 10, borderWidth: 1, gap: 5 },
  livePillText: { fontSize: 10, fontWeight: '900', letterSpacing: 0.8 },

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

  outlineBtn: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 20, paddingVertical: 12, borderRadius: 24, borderWidth: 1 },
});