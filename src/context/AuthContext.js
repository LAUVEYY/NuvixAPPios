// src/context/AuthContext.js
import React, { createContext, useState, useEffect } from 'react';
import { Alert } from 'react-native'; 
import AsyncStorage from '@react-native-async-storage/async-storage';

// 1. Firebase Compat for Firestore
import firebase from 'firebase/compat/app';
import 'firebase/compat/firestore';

// 2. Firebase Modular Auth
import { 
  initializeAuth, 
  getReactNativePersistence, 
  onAuthStateChanged, 
  signInWithEmailAndPassword, 
  createUserWithEmailAndPassword, 
  sendPasswordResetEmail, 
  sendEmailVerification, 
  signOut,
  getAuth,
  applyActionCode, // 🔥 NEW: For handling the email verification link
  confirmPasswordReset // 🔥 NEW: For handling the password reset link
} from 'firebase/auth';

const firebaseConfig = {
  apiKey: "AIzaSyB6_Gfp0C2fG9g7aOJEVr1O7opIJhDbkUA",
  authDomain: "nuvix-plus-social.firebaseapp.com",
  projectId: "nuvix-plus-social",
  storageBucket: "nuvix-plus-social.firebasestorage.app",
  messagingSenderId: "253522454193",
  appId: "1:253522454193:web:8b2e9e0f69f5fda21d6490"
};

let app;
if (!firebase.apps.length) {
  app = firebase.initializeApp(firebaseConfig);
} else {
  app = firebase.app();
}

let auth;
try {
  auth = initializeAuth(app, {
    persistence: getReactNativePersistence(AsyncStorage)
  });
} catch (e) {
  auth = getAuth(app); 
}

const db = firebase.firestore();

export const AuthContext = createContext();

const PROFILES_KEY = 'nuvix_userProfiles';

const AVATAR_COLORS = [
  '#e51c23', '#e91e63', '#9c27b0', '#673ab7',
  '#3f51b5', '#2196f3', '#03a9f4', '#009688',
  '#4caf50', '#8bc34a', '#ff9800', '#795548'
];

export const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(null); 
  const [isGuest, setIsGuest] = useState(false); 
  const [loading, setLoading] = useState(true);
  const [authReady, setAuthReady] = useState(false); 

  const [profiles, setProfiles] = useState([]);
  const [activeProfileKey, setActiveProfileKey] = useState(null);

  const activeProfile = profiles.find(p => p.key === activeProfileKey) || profiles[0];

  const _hashPassword = (password) => {
    if (!password) return null;
    let hash = 0;
    for (let i = 0; i < password.length; i++) {
        const char = password.charCodeAt(i);
        hash = (hash << 5) - hash + char;
        hash |= 0;
    }
    return `h_${hash}`;
  };

  // 🔥 THE ROUTING BRAIN: Tells Firebase how to handle Deep Links (App vs Web)
  const actionCodeSettings = {
    // Replace with your final deployed web domain (e.g., 'https://nuvix.fun')
    url: 'https://nuvix-plus-social.firebaseapp.com', 
    handleCodeInApp: true,
    // Replace these with your actual app package IDs when deploying to App Stores
    iOS: { bundleId: 'com.nuvix.app' },
    android: { packageName: 'com.nuvix.app', installApp: true, minimumVersion: '1' }
  };

  // --- 1. FIREBASE AUTH LISTENER ---
  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (firebaseUser) => {
      if (firebaseUser && firebaseUser.emailVerified) {
        setUser(firebaseUser);
        setIsGuest(false);
      } else {
        setUser(null);
      }
      setAuthReady(true); 
    });
    return unsubscribe;
  }, []);

  // --- 2. LOAD PROFILES (FIRESTORE OR LOCAL) ---
  useEffect(() => {
    if (!authReady) return;

    const loadProfiles = async () => {
      setLoading(true);
      try {
        if (user && !isGuest) {
          const profilesRef = db.collection('users').doc(user.uid).collection('profiles');
          const snapshot = await profilesRef.get();
          
          let loadedProfiles = snapshot.docs.map(doc => doc.data());

          if (loadedProfiles.length === 0) {
            if (snapshot.metadata.fromCache) {
                console.warn("Offline with empty cache. Aborting profile creation. Falling back to Guest.");
                Alert.alert(
                    "Connection Error", 
                    "Could not reach the server to load your profiles. Continuing in Guest Mode."
                );
                setIsGuest(true);
                return; 
            }

            const defaultProfile = {
              name: 'User 1', key: `profile_${Date.now()}`,
              avatarColor: AVATAR_COLORS[0], avatarImage: null, passwordHash: null,
              createdAt: firebase.firestore.FieldValue.serverTimestamp()
            };
            await profilesRef.doc(defaultProfile.key).set(defaultProfile);
            loadedProfiles = [defaultProfile];
          }
          setProfiles(loadedProfiles);
          setActiveProfileKey(null);

        } else if (isGuest) {
          const storedProfiles = await AsyncStorage.getItem(PROFILES_KEY);
          let loadedProfiles = storedProfiles ? JSON.parse(storedProfiles) : [];
          
          if (loadedProfiles.length === 0) {
            const defaultProfile = {
              name: 'Guest', key: `profile_${Date.now()}`,
              avatarColor: AVATAR_COLORS[0], avatarImage: null, passwordHash: null
            };
            loadedProfiles = [defaultProfile];
            await AsyncStorage.setItem(PROFILES_KEY, JSON.stringify(loadedProfiles));
          }
          setProfiles(loadedProfiles);
          setActiveProfileKey(null);
        }
      } catch (e) { 
          console.error("Error loading profiles:", e); 
          Alert.alert("Network Error", "Unable to sync with Nuvix+ servers. Continuing in Guest Mode.");
          setIsGuest(true);
      } finally { 
          setLoading(false); 
      }
    };

    if (user || isGuest) {
      loadProfiles();
    } else {
      setLoading(false);
    }
  }, [user, isGuest, authReady]);

  // --- 3. AUTHENTICATION ACTIONS ---
  const login = async (email, password) => {
    const userCredential = await signInWithEmailAndPassword(auth, email, password);
    if (!userCredential.user.emailVerified) {
      await signOut(auth);
      throw { code: 'auth/unverified-email', message: 'Please verify your email before logging in.' };
    }
  };

  const signup = async (email, password) => {
    const userCredential = await createUserWithEmailAndPassword(auth, email, password);
    // Attach the actionCodeSettings to trigger the Deep Link
    await sendEmailVerification(userCredential.user, actionCodeSettings);
    
    await db.collection('users').doc(userCredential.user.uid).set({
      email: email,
      createdAt: firebase.firestore.FieldValue.serverTimestamp(),
      dataSynced: true
    }, { merge: true });

    await signOut(auth); 
  };

  const resetPassword = async (email) => {
    // Attach the actionCodeSettings to trigger the Deep Link
    await sendPasswordResetEmail(auth, email, actionCodeSettings);
  };

  // 🔥 NEW: Deep Link Handlers
  const verifyEmailCode = async (code) => {
    return await applyActionCode(auth, code);
  };

  const confirmNewPassword = async (code, newPassword) => {
    return await confirmPasswordReset(auth, code, newPassword);
  };

  const loginAsGuest = () => { setIsGuest(true); };
  
  const logout = async () => { 
    await signOut(auth);
    setUser(null); 
    setIsGuest(false); 
    setActiveProfileKey(null); 
  };

  // --- 4. PROFILE ACTIONS ---
  const switchProfile = (key) => { setActiveProfileKey(key); };

  const addProfile = async (profileData) => {
    const { name, password, avatarColor, avatarImage } = profileData;
    if (!name || !name.trim() || profiles.length >= 5) return null;

    const newProfile = {
        name: name.trim(),
        key: `profile_${Date.now()}`,
        avatarColor: avatarColor || AVATAR_COLORS[Math.floor(Math.random() * AVATAR_COLORS.length)],
        avatarImage: avatarImage || null,
        passwordHash: _hashPassword(password),
    };

    const updatedProfiles = [...profiles, newProfile];
    setProfiles(updatedProfiles);

    if (user && !isGuest) {
      newProfile.createdAt = firebase.firestore.FieldValue.serverTimestamp();
      await db.collection('users').doc(user.uid).collection('profiles').doc(newProfile.key).set(newProfile);
    } else {
      await AsyncStorage.setItem(PROFILES_KEY, JSON.stringify(updatedProfiles));
    }
    return newProfile;
  };

  const updateProfile = async (profileKey, updateData) => {
    const dataForDb = { ...updateData };
    if (dataForDb.password !== undefined) {
        if (dataForDb.password === null) dataForDb.passwordHash = null;
        else dataForDb.passwordHash = _hashPassword(dataForDb.password);
        delete dataForDb.password;
    }

    const updatedProfiles = profiles.map(p => p.key === profileKey ? { ...p, ...dataForDb } : p);
    setProfiles(updatedProfiles);

    if (user && !isGuest) {
      await db.collection('users').doc(user.uid).collection('profiles').doc(profileKey).set(dataForDb, { merge: true });
    } else {
      await AsyncStorage.setItem(PROFILES_KEY, JSON.stringify(updatedProfiles));
    }
  };

  const removeProfile = async (profileKey) => {
    if (profiles.length <= 1) return false;

    const updatedProfiles = profiles.filter(p => p.key !== profileKey);
    setProfiles(updatedProfiles);
    if (activeProfileKey === profileKey) switchProfile(updatedProfiles[0].key);

    if (user && !isGuest) {
      await db.collection('users').doc(user.uid).collection('profiles').doc(profileKey).delete();
    } else {
      await AsyncStorage.setItem(PROFILES_KEY, JSON.stringify(updatedProfiles));
    }
    return true;
  };

  const verifyPassword = (profileKey, password) => {
    const hashedPassword = _hashPassword(password);
    const profile = profiles.find(p => p.key === profileKey);
    return profile ? profile.passwordHash === hashedPassword : false;
  };

  return (
    <AuthContext.Provider value={{ 
      user, isGuest, loading, login, signup, resetPassword, loginAsGuest, logout,
      verifyEmailCode, confirmNewPassword, // 🔥 Exported the Deep Link Handlers
      profiles, activeProfile, activeProfileKey, switchProfile,
      addProfile, updateProfile, removeProfile, verifyPassword, AVATAR_COLORS
    }}>
      {children}
    </AuthContext.Provider>
  );
};