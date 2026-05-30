import React, { useEffect } from 'react';
import { View } from 'react-native';
import { StatusBar } from 'expo-status-bar';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { NavigationContainer } from '@react-navigation/native';
import * as SplashScreen from 'expo-splash-screen';
import * as Linking from 'expo-linking';

// --- Font Loading ---
import { useFonts, Fredoka_700Bold } from '@expo-google-fonts/fredoka';

// --- Context Providers ---
import { ThemeProvider } from './src/context/ThemeContext';
import { AuthProvider } from './src/context/AuthContext';
import { LibraryProvider } from './src/context/LibraryContext';

// --- Main Navigation ---
import RootNavigator from './src/navigation/RootNavigator';

// Prevent the splash screen from auto-hiding before asset loading is complete.
SplashScreen.preventAutoHideAsync();

// Define your deep linking prefix
const prefix = Linking.createURL('/');

export default function App() {
  // --- LOAD CUSTOM FONTS ---
  let [fontsLoaded, fontError] = useFonts({
    Fredoka_700Bold, 
  });

  useEffect(() => {
    async function hideSplashScreen() {
      // Hide the splash screen once fonts are loaded (or if there was an error)
      if (fontsLoaded || fontError) {
        await SplashScreen.hideAsync();
      }
    }
    
    hideSplashScreen();
  }, [fontsLoaded, fontError]);

  // --- DEEP LINKING CONFIG ---
  const linking = {
    prefixes: [prefix, 'Nuvix://', 'https://nuvix.app'],
    config: {
      screens: {
        SharedMixtape: 'mixtape/:mixtapeId',
      },
    },
  };

  // If the font isn't finished loading and there's no error, return null.
  // The native splash screen will remain visible until hideAsync() is called.
  if (!fontsLoaded && !fontError) {
    return null;
  }

  return (
    <SafeAreaProvider>
      <AuthProvider>
        <LibraryProvider>
          <ThemeProvider>
            <StatusBar style="light" />
            
            <NavigationContainer linking={linking}>
              <RootNavigator />
            </NavigationContainer>
            
          </ThemeProvider>
        </LibraryProvider>
      </AuthProvider>
    </SafeAreaProvider>
  );
}