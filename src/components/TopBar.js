// src/components/TopBar.js
import React, { useState, useContext, useEffect, useRef } from 'react';
import { 
  View, Text, StyleSheet, TouchableOpacity, Image, 
  Modal, TouchableWithoutFeedback, useWindowDimensions, Platform,
  DeviceEventEmitter, Animated
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { BlurView } from 'expo-blur'; 
import { useNavigation, useRoute } from '@react-navigation/native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { ThemeContext } from '../context/ThemeContext';
import { AuthContext } from '../context/AuthContext';

const getDarkerShade = (hex, percent = -30) => {
  if (!hex) return '#000000';
  let R = parseInt(hex.substring(1,3),16);
  let G = parseInt(hex.substring(3,5),16);
  let B = parseInt(hex.substring(5,7),16);
  R = parseInt(R * (100 + percent) / 100);
  G = parseInt(G * (100 + percent) / 100);
  B = parseInt(B * (100 + percent) / 100);
  R = (R<255)?R:255; G = (G<255)?G:255; B = (B<255)?B:255;
  R = Math.round((R<0)?0:R); G = Math.round((G<0)?0:G); B = Math.round((B<0)?0:B);
  const RR = ((R.toString(16).length==1)?"0"+R.toString(16):R.toString(16));
  const GG = ((G.toString(16).length==1)?"0"+G.toString(16):G.toString(16));
  const BB = ((B.toString(16).length==1)?"0"+B.toString(16):B.toString(16));
  return "#"+RR+GG+BB;
};

export default function TopBar() {
  const { theme, isDarkMode } = useContext(ThemeContext);
  const { activeProfile, user, logout } = useContext(AuthContext);
  
  const navigation = useNavigation();
  const route = useRoute();
  const insets = useSafeAreaInsets();
  const { width } = useWindowDimensions();
  const isTablet = width >= 768;

  const [dropdownVisible, setDropdownVisible] = useState(false);
  const activeCategory = route.name === 'Home' ? (route.params?.category || 'Home') : null;

  // Check if we are on the Home screen
  const isHome = route.name === 'Home';

  // --- SCROLL ANIMATION LOGIC ---
  const scrollAnim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    const subscription = DeviceEventEmitter.addListener('navScroll', (isScrolled) => {
      Animated.timing(scrollAnim, {
        toValue: isScrolled ? 1 : 0,
        duration: 250,
        useNativeDriver: false, 
      }).start();
    });
    return () => subscription.remove();
  }, []);

  const animatedBgColor = scrollAnim.interpolate({
    inputRange: [0, 1],
    outputRange: ['rgba(0,0,0,0)', theme.background] 
  });

  const handleCategoryPress = (category) => {
    navigation.navigate('Home', { category });
  };

  const handleLogout = () => {
    setDropdownVisible(false);
    logout();
  };

  const renderAvatar = (profile, size = 36) => {
    if (!profile) return null;
    const initial = profile.name ? profile.name.charAt(0).toUpperCase() : '?';
    const gradientColors = [profile.avatarColor, getDarkerShade(profile.avatarColor)];

    if (profile.avatarImage) {
      return <Image source={{ uri: profile.avatarImage }} style={{ width: size, height: size, borderRadius: size / 2 }} />;
    }
    return (
      <LinearGradient colors={gradientColors} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={{ width: size, height: size, borderRadius: size / 2, justifyContent: 'center', alignItems: 'center' }}>
        <Text style={{ color: '#fff', fontSize: size * 0.45, fontWeight: 'bold' }}>{initial}</Text>
      </LinearGradient>
    );
  };

  const topPadding = Math.max(insets.top, Platform.OS === 'android' ? 10 : 0);

  return (
    <Animated.View style={[
      styles.container, 
      { 
        // 1. Overlay globally ONLY on Home screen. Otherwise flow normally.
        position: isHome ? 'absolute' : 'relative',
        top: isHome ? 0 : undefined,
        left: isHome ? 0 : undefined,
        backgroundColor: isHome ? animatedBgColor : theme.background, 
        paddingTop: topPadding,
        // 2. THE MAGIC FIX: Cancel out the screen double-padding natively
        marginBottom: isHome ? 0 : -topPadding
      }
    ]}>
      
      <View style={styles.innerContainer}>
        <View style={styles.leftSection}>
          {isTablet && (
            <View style={styles.categoriesRow}>
              {['Home', 'Movies', 'TV Shows', 'Originals', 'Kids'].map((cat) => (
                <TouchableOpacity key={cat} onPress={() => handleCategoryPress(cat)}>
                  <Text style={[
                    styles.categoryText, 
                    { color: activeCategory === cat ? theme.text : theme.textSecondary, fontWeight: activeCategory === cat ? 'bold' : '600' }
                  ]}>
                    {cat}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>
          )}
        </View>

        <View style={styles.rightSection}>
          <TouchableOpacity style={[styles.circleBtn, { backgroundColor: isDarkMode ? '#1A1A1A' : '#E5E5E5' }]} onPress={() => navigation.navigate('Search')}>
            <Ionicons name="search" size={20} color={theme.text} />
          </TouchableOpacity>

          <TouchableOpacity style={[styles.circleBtn, { backgroundColor: isDarkMode ? '#1A1A1A' : '#E5E5E5', marginRight: 20 }]}>
            <Ionicons name="notifications-outline" size={20} color={theme.text} />
            <View style={styles.notificationDot} />
          </TouchableOpacity>

          <TouchableOpacity style={styles.profileBtn} activeOpacity={0.7} onPress={() => setDropdownVisible(true)}>
            {renderAvatar(activeProfile)}
            <Ionicons name="chevron-down" size={14} color={theme.textSecondary} style={{ marginLeft: 6 }} />
          </TouchableOpacity>
        </View>
      </View>

      <Modal visible={dropdownVisible} transparent={true} animationType="fade">
        <TouchableWithoutFeedback onPress={() => setDropdownVisible(false)}>
          <View style={styles.modalOverlay}>
            <TouchableWithoutFeedback>
              <BlurView 
                intensity={isDarkMode ? 40 : 80} 
                tint={isDarkMode ? 'dark' : 'light'}
                style={[styles.dropdownMenu, { borderColor: theme.border, top: topPadding + 65 }]}
              >
                <View style={styles.dropdownHeader}>
                  <Text style={[styles.dropdownProfileName, { color: theme.text }]}>{activeProfile?.name || 'User'}</Text>
                  <Text style={[styles.dropdownEmail, { color: theme.textSecondary }]}>{user?.email || 'guest@nuvix.com'}</Text>
                </View>
                <View style={styles.linksContainer}>
                  <TouchableOpacity style={styles.dropdownActionRow} onPress={() => { setDropdownVisible(false); navigation.navigate('Profile'); }}>
                    <Text style={[styles.dropdownActionText, { color: theme.text }]}>My Profile</Text>
                  </TouchableOpacity>
                  <TouchableOpacity style={styles.dropdownActionRow} onPress={() => { setDropdownVisible(false); navigation.navigate('Library'); }}>
                    <Text style={[styles.dropdownActionText, { color: theme.text }]}>My Library</Text>
                  </TouchableOpacity>
                </View>
                <View style={[styles.divider, { backgroundColor: theme.border }]} />
                <TouchableOpacity style={styles.dropdownActionRow} onPress={handleLogout}>
                  <Text style={[styles.dropdownActionText, { color: '#e51c23' }]}>Sign Out</Text>
                </TouchableOpacity>
              </BlurView>
            </TouchableWithoutFeedback>
          </View>
        </TouchableWithoutFeedback>
      </Modal>

    </Animated.View>
  );
}

const styles = StyleSheet.create({
  container: { width: '100%', zIndex: 100 },
  innerContainer: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', height: 60, paddingHorizontal: 25 },
  leftSection: { flexDirection: 'row', alignItems: 'center' },
  categoriesRow: { flexDirection: 'row', alignItems: 'center', gap: 30 },
  categoryText: { fontSize: 15 },
  rightSection: { flexDirection: 'row', alignItems: 'center' },
  circleBtn: { width: 36, height: 36, borderRadius: 18, justifyContent: 'center', alignItems: 'center', marginRight: 12 },
  notificationDot: { position: 'absolute', top: 8, right: 8, width: 8, height: 8, borderRadius: 4, backgroundColor: '#e51c23', borderWidth: 1.5, borderColor: '#1A1A1A' },
  profileBtn: { flexDirection: 'row', alignItems: 'center' },
  modalOverlay: { flex: 1, backgroundColor: 'transparent' },
  dropdownMenu: { position: 'absolute', right: 25, width: 250, borderRadius: 16, borderWidth: 1, paddingVertical: 10, shadowColor: '#000', shadowOffset: { width: 0, height: 10 }, shadowOpacity: 0.5, shadowRadius: 15, elevation: 10, overflow: 'hidden', backgroundColor: 'rgba(20, 20, 20, 0.45)' },
  dropdownHeader: { paddingHorizontal: 20, paddingTop: 10, paddingBottom: 15 },
  dropdownProfileName: { fontSize: 16, fontWeight: 'bold', marginBottom: 4 },
  dropdownEmail: { fontSize: 12 },
  linksContainer: { paddingVertical: 5 },
  dropdownActionRow: { paddingVertical: 14, paddingHorizontal: 20 },
  dropdownActionText: { fontSize: 15, fontWeight: '600' },
  divider: { height: 1, width: '100%', marginVertical: 5 },
});