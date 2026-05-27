// src/context/ThemeContext.js
import React, { createContext, useState, useEffect } from 'react';
import { Appearance } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { lightTheme, darkTheme } from '../constants/theme';

export const ThemeContext = createContext();

export const ThemeProvider = ({ children }) => {
  const systemColorScheme = Appearance.getColorScheme();
  
  // Theme States
  const [themeMode, setThemeMode] = useState('system'); 
  const [isDarkMode, setIsDarkMode] = useState(systemColorScheme === 'dark');

  // 🔥 NEW: App Preference States (Lifted from ProfileScreen)
  const [dataSaver, setDataSaver] = useState(false);
  const [autoplayTrailers, setAutoplayTrailers] = useState(true);

  // 1. Load ALL saved preferences on mount
  useEffect(() => {
    const loadPreferences = async () => {
      try {
        const savedTheme = await AsyncStorage.getItem('nuvix_theme_preference');
        if (savedTheme) setThemeMode(savedTheme);

        const ds = await AsyncStorage.getItem('nuvix_data_saver');
        if (ds !== null) setDataSaver(ds === 'true');

        const ap = await AsyncStorage.getItem('nuvix_autoplay');
        if (ap !== null) setAutoplayTrailers(ap === 'true');
      } catch (error) {
        console.error('Error loading preferences:', error);
      }
    };
    loadPreferences();
  }, []);

  // 2. Manage Theme OS Sync
  useEffect(() => {
    if (themeMode === 'system') {
      setIsDarkMode(Appearance.getColorScheme() === 'dark');
    } else {
      setIsDarkMode(themeMode === 'dark');
    }
  }, [themeMode]);

  useEffect(() => {
    const subscription = Appearance.addChangeListener(({ colorScheme }) => {
      if (themeMode === 'system') {
        setIsDarkMode(colorScheme === 'dark');
      }
    });
    return () => subscription.remove();
  }, [themeMode]);

  // 3. Global Update Functions
  const changeThemeMode = async (mode) => {
    setThemeMode(mode);
    await AsyncStorage.setItem('nuvix_theme_preference', mode);
  };

  const toggleDataSaver = async (val) => {
    setDataSaver(val);
    await AsyncStorage.setItem('nuvix_data_saver', String(val));
  };

  const toggleAutoplayTrailers = async (val) => {
    setAutoplayTrailers(val);
    await AsyncStorage.setItem('nuvix_autoplay', String(val));
  };

  const theme = isDarkMode ? darkTheme : lightTheme;

  return (
    <ThemeContext.Provider value={{ 
        theme, isDarkMode, themeMode, changeThemeMode,
        dataSaver, toggleDataSaver, 
        autoplayTrailers, toggleAutoplayTrailers
    }}>
      {children}
    </ThemeContext.Provider>
  );
};