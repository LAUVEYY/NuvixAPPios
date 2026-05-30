// src/navigation/RootNavigator.js
import React, { useContext, useEffect, useState } from 'react';
import { useWindowDimensions, View, Text, Platform, StyleSheet, ActivityIndicator } from 'react-native';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { createDrawerNavigator, DrawerContentScrollView, DrawerItemList } from '@react-navigation/drawer'; 
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context'; 
import * as ScreenOrientation from 'expo-screen-orientation'; 
import * as Linking from 'expo-linking';
import { useNavigation } from '@react-navigation/native';

import { ThemeContext } from '../context/ThemeContext';
import { AuthContext } from '../context/AuthContext'; 
import TopBar from '../components/TopBar';
import { LinearGradient } from 'expo-linear-gradient';
import MaskedView from '@react-native-masked-view/masked-view';

// --- SCREENS ---
import AuthScreen from '../screens/AuthScreen'; 
import ProfileSelectionScreen from '../screens/ProfileSelectionScreen'; 
import HomeScreen from '../screens/HomeScreen';
import BrowseScreen from '../screens/BrowseScreen';
import SearchScreen from '../screens/SearchScreen';
import ProfileScreen from '../screens/ProfileScreen';
import LibraryScreen from '../screens/LibraryScreen';
import DetailsScreen from '../screens/DetailsScreen';
import SharedMixtapeScreen from '../screens/SharedMixtapeScreen';

const Tab = createBottomTabNavigator();
const Drawer = createDrawerNavigator();
const Stack = createNativeStackNavigator();

// ============================================================================
// 1. MOBILE BOTTOM TABS
// ============================================================================
const MobileNavigator = () => {
  const { theme } = useContext(ThemeContext);
  const insets = useSafeAreaInsets();
  
  const isWeb = Platform.OS === 'web';

  // 🔥 FIX: Dynamic height. Web gets a taller 58px base to compensate for browser UI.
  // Native stays at the sleek 48px because `nativeSafeBottom` adds the physical device lift.
  const nativeSafeBottom = Math.max(insets.bottom, 0); 
  const baseTabBarHeight = isWeb ? 58 : 48; 
  const nativeTotalHeight = baseTabBarHeight + nativeSafeBottom;

  return (
    <Tab.Navigator
      sceneContainerStyle={{ 
        paddingBottom: isWeb ? `calc(${baseTabBarHeight}px + env(safe-area-inset-bottom))` : nativeTotalHeight 
      }}
      
      screenOptions={({ route }) => ({
        header: () => <TopBar />, 
        
        tabBarIcon: ({ focused, color }) => {
          let iconName = 'albums'; 
          if (route.name === 'Home') iconName = focused ? 'home' : 'home-outline';
          else if (route.name === 'Browse') iconName = focused ? 'grid' : 'grid-outline';
          else if (route.name === 'Search') iconName = focused ? 'search' : 'search-outline';
          else if (route.name === 'Library') iconName = focused ? 'bookmark' : 'bookmark-outline';
          else if (route.name === 'Profile') iconName = focused ? 'person' : 'person-outline';

          return <Ionicons name={iconName} size={24} color={color} />;
        },
        tabBarActiveTintColor: theme.primary,
        tabBarInactiveTintColor: theme.textSecondary,
        tabBarShowLabel: false, 
        
        tabBarItemStyle: route.name === 'SharedMixtape' ? { display: 'none' } : {
          justifyContent: 'center',
          alignItems: 'center',
          paddingTop: isWeb ? 6 : (Platform.OS === 'ios' ? 2 : 0), // Adjusted padding to keep icons perfectly centered
        },

        tabBarStyle: {
          position: isWeb ? 'fixed' : 'absolute',
          bottom: 0,
          left: 0,
          right: 0,
          elevation: 0, 
          borderTopWidth: 1, 
          borderTopColor: theme.border,
          backgroundColor: theme.surface, 
          height: isWeb ? `calc(${baseTabBarHeight}px + env(safe-area-inset-bottom))` : nativeTotalHeight, 
          paddingBottom: isWeb ? 'env(safe-area-inset-bottom)' : nativeSafeBottom, 
        },
      })}
    >
      <Tab.Screen 
        name="Home" 
        component={HomeScreen} 
        options={{ headerTransparent: true }} 
      />
      <Tab.Screen name="Browse" component={BrowseScreen} />
      <Tab.Screen name="Search" component={SearchScreen} />
      <Tab.Screen name="Library" component={LibraryScreen} />
      <Tab.Screen name="Profile" component={ProfileScreen} />
      
      <Tab.Screen 
        name="SharedMixtape" 
        component={SharedMixtapeScreen} 
        options={{ tabBarButton: () => null }} 
      />
    </Tab.Navigator>
  );
};

// ============================================================================
// 2. CUSTOM SIDEBAR HEADER (Tablet)
// ============================================================================
const CustomDrawerContent = (props) => {
  return (
    <DrawerContentScrollView {...props} contentContainerStyle={{ paddingTop: 0 }}>
      <View style={{ paddingHorizontal: 25, paddingTop: 40, paddingBottom: 30, justifyContent: 'center' }}>
        
        <View style={styles.logoContainer}>
          <Text style={[styles.logoText, styles.shadowText]}>
            Nuvix+
          </Text>

          {Platform.OS === 'web' ? (
            <Text
              style={[
                styles.logoText,
                {
                  backgroundImage: 'linear-gradient(90deg, #6ae70e 0%, #08fded 20%, #0072ed 60%)',
                  WebkitBackgroundClip: 'text',
                  WebkitTextFillColor: 'transparent',
                },
              ]}
            >
              Nuvix+
            </Text>
          ) : (
            <MaskedView
              maskElement={<Text style={styles.logoText}>Nuvix+</Text>}
            >
              <LinearGradient
                colors={['#6ae70e', '#08fded', '#0072ed']}
                locations={[0, 0.2, 0.6]}
                start={{ x: 0, y: 0 }} 
                end={{ x: 1, y: 0 }}
                style={{ flexDirection: 'row' }}
              >
                <Text style={[styles.logoText, { opacity: 0 }]}>
                  Nuvix+
                </Text>
              </LinearGradient>
            </MaskedView>
          )}
        </View>

      </View>
      <DrawerItemList {...props} />
    </DrawerContentScrollView>
  );
};

const styles = StyleSheet.create({
  logoContainer: {
    position: 'relative', 
  },
  logoText: {
    fontFamily: 'Fredoka_700Bold',
    fontSize: 32,
    letterSpacing: 1,
    backgroundColor: 'transparent',
  },
  shadowText: {
    position: 'absolute',
    top: 2, 
    left: 1, 
    color: 'rgba(0, 0, 0, 0.25)', 
  }
});

// ============================================================================
// 3. TABLET DRAWER NAVIGATOR
// ============================================================================
const TabletNavigator = () => {
  const { theme } = useContext(ThemeContext);

  return (
    <Drawer.Navigator
      drawerContent={(props) => <CustomDrawerContent {...props} />} 
      screenOptions={{
        header: () => <TopBar />, 
        drawerType: 'permanent', 
        drawerStyle: {
          backgroundColor: theme.background, 
          width: 250,
          borderRightColor: theme.border,
          borderRightWidth: 1,
        },
        drawerActiveTintColor: theme.primary,
        drawerInactiveTintColor: theme.textSecondary,
        drawerActiveBackgroundColor: theme.primary + '33', 
      }}
    >
      <Drawer.Screen 
        name="Home" 
        component={HomeScreen} 
        options={{ 
          drawerIcon: ({color}) => <Ionicons name="home-outline" size={22} color={color} />,
          headerTransparent: true 
        }} 
      />
      <Drawer.Screen 
        name="Browse" 
        component={BrowseScreen} 
        options={{ drawerIcon: ({color}) => <Ionicons name="grid-outline" size={22} color={color} /> }} 
      />
      <Drawer.Screen 
        name="Search" 
        component={SearchScreen} 
        options={{ drawerIcon: ({color}) => <Ionicons name="search-outline" size={22} color={color} /> }} 
      />
      <Drawer.Screen 
        name="Library" 
        component={LibraryScreen} 
        options={{ drawerIcon: ({color}) => <Ionicons name="bookmark-outline" size={22} color={color} /> }} 
      />
      <Drawer.Screen 
        name="Profile" 
        component={ProfileScreen} 
        options={{ drawerIcon: ({color}) => <Ionicons name="person-outline" size={22} color={color} /> }} 
      />
      
      <Drawer.Screen 
        name="SharedMixtape" 
        component={SharedMixtapeScreen} 
        options={{ drawerItemStyle: { display: 'none' } }} 
      />
    </Drawer.Navigator>
  );
};

// ============================================================================
// 4. MAIN ROOT STACK
// ============================================================================
export default function RootNavigator() {
  const { width, height } = useWindowDimensions();
  const navigation = useNavigation();
  
  const { activeProfileKey, user, isGuest, loading } = useContext(AuthContext); 
  
  const [pendingMixtapeId, setPendingMixtapeId] = useState(null);
  const [pendingIsCollab, setPendingIsCollab] = useState(false);
  const [pendingMedia, setPendingMedia] = useState(null); 
  
  const isTabletDevice = Platform.OS === 'ios' ? Platform.isPad : Math.min(width, height) >= 600; 
  const isLandscape = width > height;
  const useSidebar = isTabletDevice && isLandscape;

  useEffect(() => {
    async function lockOrientation() {
      if (isTabletDevice) {
        await ScreenOrientation.unlockAsync();
      } else {
        await ScreenOrientation.lockAsync(ScreenOrientation.OrientationLock.PORTRAIT_UP);
      }
    }
    lockOrientation();
  }, [isTabletDevice]);

  useEffect(() => {
    const handleUrl = (url) => {
      if (!url) return;
      
      if (url.includes('collab/')) {
        const id = url.split('collab/')[1]?.split('?')[0]?.split('/')[0];
        if (id) {
          setPendingMixtapeId(id);
          setPendingIsCollab(true);
        }
      }
      else if (url.includes('mixtape/')) {
        const id = url.split('mixtape/')[1]?.split('?')[0]?.split('/')[0];
        if (id) {
          setPendingMixtapeId(id);
          setPendingIsCollab(false);
        }
      } 
      else if (url.includes('movie/')) {
        const id = url.split('movie/')[1]?.split('?')[0]?.split('/')[0];
        if (id) setPendingMedia({ id, type: 'movie' });
      } 
      else if (url.includes('tv/')) {
        const id = url.split('tv/')[1]?.split('?')[0]?.split('/')[0];
        if (id) setPendingMedia({ id, type: 'tv' });
      }
    };

    Linking.getInitialURL().then(handleUrl);
    const subscription = Linking.addEventListener('url', ({ url }) => handleUrl(url));
    return () => subscription.remove();
  }, []);

  useEffect(() => {
    if (activeProfileKey) {
      if (pendingMixtapeId) {
        const timer = setTimeout(() => {
           navigation.navigate('MainTabs', { 
             screen: 'SharedMixtape', 
             params: { 
               mixtapeId: pendingMixtapeId, 
               isCollab: pendingIsCollab 
             } 
           });
           setPendingMixtapeId(null);
           setPendingIsCollab(false);
        }, 300);
        return () => clearTimeout(timer);
      }

      if (pendingMedia) {
        const timer = setTimeout(() => {
           navigation.navigate('Details', { id: pendingMedia.id, type: pendingMedia.type });
           setPendingMedia(null);
        }, 300);
        return () => clearTimeout(timer);
      }
    }
  }, [activeProfileKey, pendingMixtapeId, pendingIsCollab, pendingMedia, navigation]);

  if (loading) {
    return (
      <View style={{ flex: 1, backgroundColor: '#000', justifyContent: 'center', alignItems: 'center' }}>
        <ActivityIndicator size="large" color="#0071eb" />
      </View>
    );
  }

  return (
    <Stack.Navigator screenOptions={{ headerShown: false }}>
      {(!user && !isGuest) ? (
        <Stack.Screen name="Auth" component={AuthScreen} />
      ) : !activeProfileKey ? (
        <Stack.Screen name="ProfileSelection" component={ProfileSelectionScreen} />
      ) : (
        <>
          <Stack.Screen 
             name="MainTabs" 
             component={useSidebar ? TabletNavigator : MobileNavigator} 
          />
          <Stack.Screen 
            name="Details" 
            component={DetailsScreen} 
            options={{ presentation: 'modal' }} 
          />
        </>
      )}
    </Stack.Navigator>
  );
}