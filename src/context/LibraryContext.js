// src/context/LibraryContext.js
import React, { createContext, useState, useEffect, useContext } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import firebase from 'firebase/compat/app';
import 'firebase/compat/firestore';
import { AuthContext } from './AuthContext';

export const LibraryContext = createContext();

export const LibraryProvider = ({ children }) => {
  const { user, isGuest, activeProfileKey } = useContext(AuthContext);
  
  const [watchlist, setWatchlist] = useState([]);
  const [history, setHistory] = useState([]);
  const [mixtapes, setMixtapes] = useState([]); 
  const db = firebase.firestore();

  useEffect(() => {
    if (!activeProfileKey) {
        setWatchlist([]);
        setHistory([]);
        setMixtapes([]);
        return;
    }

    let unsubscribeList = null;
    let unsubscribeHistory = null;
    let unsubscribeMixtapes = null;

    if (user && !isGuest) {
        const profileDbRef = db.collection('users').doc(user.uid).collection('profiles').doc(activeProfileKey);
        
        unsubscribeList = profileDbRef.collection('myList').onSnapshot(snapshot => {
            const listData = snapshot.docs.map(doc => doc.data());
            setWatchlist(listData);
        }, error => console.error("Error syncing MyList:", error));

        unsubscribeHistory = profileDbRef.collection('watchHistory')
            .orderBy('watchedAt', 'desc')
            .limit(100)
            .onSnapshot(snapshot => {
                const historyData = snapshot.docs.map(doc => doc.data());
                const uniqueHistory = historyData.filter((item, index, self) =>
                    index === self.findIndex((t) => t.id === item.id)
                );
                setHistory(uniqueHistory);
            }, error => console.error("Error syncing History:", error));

        unsubscribeMixtapes = profileDbRef.collection('mixtapes')
            .orderBy('createdAt', 'desc')
            .onSnapshot(snapshot => {
                const mixData = snapshot.docs.map(doc => doc.data());
                setMixtapes(mixData);
            }, error => console.error("Error syncing Mixtapes:", error));

    } else {
        const loadLocalData = async () => {
            try {
                const localList = await AsyncStorage.getItem(`myList_${activeProfileKey}`);
                if (localList) setWatchlist(JSON.parse(localList));
                
                const localHistory = await AsyncStorage.getItem(`recentlyWatched_${activeProfileKey}`);
                if (localHistory) {
                    const parsedHistory = JSON.parse(localHistory);
                    const uniqueHistory = parsedHistory.filter((item, index, self) =>
                        index === self.findIndex((t) => t.id === item.id)
                    );
                    setHistory(uniqueHistory);
                }

                const localMixtapes = await AsyncStorage.getItem(`mixtapes_${activeProfileKey}`);
                if (localMixtapes) setMixtapes(JSON.parse(localMixtapes));

            } catch (error) {
                console.error("Error loading local library:", error);
            }
        };
        loadLocalData();
    }

    return () => {
        if (unsubscribeList) unsubscribeList();
        if (unsubscribeHistory) unsubscribeHistory();
        if (unsubscribeMixtapes) unsubscribeMixtapes();
    };
  }, [user, isGuest, activeProfileKey]);

  const isInWatchlist = (id) => watchlist.some(item => item.id === id);

  const toggleWatchlist = async (item) => {
    if (!activeProfileKey) return;
    const itemType = item.type || item.media_type || (item.name && !item.title ? 'tv' : 'movie');
    const itemData = {
        id: item.id, type: itemType, title: item.title || item.name,
        poster_path: item.poster_path, backdrop_path: item.backdrop_path || null,
        vote_average: item.vote_average || 0, release_date: item.release_date || item.first_air_date || null
    };

    if (user && !isGuest) {
        const docRef = db.collection('users').doc(user.uid).collection('profiles').doc(activeProfileKey).collection('myList').doc(`${itemType}-${item.id}`);
        if (isInWatchlist(item.id)) await docRef.delete();
        else await docRef.set(itemData);
    } else {
        let newList = [...watchlist];
        if (isInWatchlist(item.id)) newList = newList.filter(i => i.id !== item.id);
        else newList.push(itemData);
        setWatchlist(newList);
        await AsyncStorage.setItem(`myList_${activeProfileKey}`, JSON.stringify(newList));
    }
  };

  const addToHistory = async (item) => {
    if (!activeProfileKey) return;
    const itemType = item.type || item.media_type || (item.name && !item.title ? 'tv' : 'movie');
    const historyItem = {
        id: item.id, type: itemType, title: item.title || item.name,
        poster_path: item.poster_path, backdrop_path: item.backdrop_path || null,
        episode_still_path: item.episode_still_path || null, last_watched_season: item.last_watched_season || null, 
        last_watched_episode: item.last_watched_episode || null, savedProgress: item.savedProgress || 0, 
        progressMap: item.progressMap || {}, watchedAt: Date.now()
    };

    if (user && !isGuest) {
        const docRef = db.collection('users').doc(user.uid).collection('profiles').doc(activeProfileKey).collection('watchHistory').doc(`${itemType}-${item.id}`);
        await docRef.set(historyItem, { merge: true });
    } else {
        let newHistory = history.filter(i => i.id !== item.id);
        newHistory.unshift(historyItem);
        newHistory = newHistory.slice(0, 100); 
        setHistory(newHistory);
        await AsyncStorage.setItem(`recentlyWatched_${activeProfileKey}`, JSON.stringify(newHistory));
    }
  };

  const removeFromHistory = async (itemId) => {
    if (!activeProfileKey) return;
    try {
        const itemToRemove = history.find(item => item.id === itemId);
        if (!itemToRemove) return;
        const itemType = itemToRemove.type || itemToRemove.media_type || (itemToRemove.name && !itemToRemove.title ? 'tv' : 'movie');

        if (user && !isGuest) {
            const docRef = db.collection('users').doc(user.uid).collection('profiles').doc(activeProfileKey).collection('watchHistory').doc(`${itemType}-${itemId}`);
            await docRef.delete();
        } else {
            const updatedHistory = history.filter((item) => item.id !== itemId);
            setHistory(updatedHistory);
            await AsyncStorage.setItem(`recentlyWatched_${activeProfileKey}`, JSON.stringify(updatedHistory)); 
        }
    } catch (error) { console.error("Error removing from history:", error); }
  };

  // 🔥 ENGINE UPGRADE: Mixtapes now accept 'description' parameter
  const createMixtape = async (title, description = '') => {
    if (!activeProfileKey || !title.trim()) return;
    const newId = Date.now().toString();
    const newMixtape = { id: newId, title: title.trim(), description: description.trim(), items: [], coverStyle: 'mosaic', customCoverImage: null, createdAt: Date.now() };

    if (user && !isGuest) {
        await db.collection('users').doc(user.uid).collection('profiles').doc(activeProfileKey).collection('mixtapes').doc(newId).set(newMixtape);
    } else {
        const updated = [newMixtape, ...mixtapes];
        setMixtapes(updated);
        await AsyncStorage.setItem(`mixtapes_${activeProfileKey}`, JSON.stringify(updated));
    }
  };

  const toggleInMixtape = async (mixtapeId, item) => {
    if (!activeProfileKey) return;
    const targetMix = mixtapes.find(m => m.id === mixtapeId);
    if (!targetMix) return;

    const itemType = item.type || item.media_type || (item.name && !item.title ? 'tv' : 'movie');
    const itemData = {
        id: item.id, type: itemType, title: item.title || item.name,
        poster_path: item.poster_path, backdrop_path: item.backdrop_path || null,
        vote_average: item.vote_average || 0, release_date: item.release_date || item.first_air_date || null
    };

    const existingIndex = targetMix.items.findIndex(i => i.id === item.id);
    let newItems = [...targetMix.items];

    if (existingIndex >= 0) newItems.splice(existingIndex, 1);
    else newItems.unshift(itemData);

    if (user && !isGuest) {
        await db.collection('users').doc(user.uid).collection('profiles').doc(activeProfileKey).collection('mixtapes').doc(mixtapeId).update({ items: newItems });
    } else {
        const updated = mixtapes.map(m => m.id === mixtapeId ? { ...m, items: newItems } : m);
        setMixtapes(updated);
        await AsyncStorage.setItem(`mixtapes_${activeProfileKey}`, JSON.stringify(updated));
    }
  };

  // 🔥 ENGINE UPGRADE: Updates now accept 'description'
  const updateMixtapeStyle = async (mixtapeId, style, customImage = null, newTitle = null, newDesc = null) => {
    if (!activeProfileKey) return;
    const updates = { coverStyle: style };
    if (customImage !== null) updates.customCoverImage = customImage;
    if (newTitle !== null) updates.title = newTitle;
    if (newDesc !== null) updates.description = newDesc;

    if (user && !isGuest) {
        await db.collection('users').doc(user.uid).collection('profiles').doc(activeProfileKey).collection('mixtapes').doc(mixtapeId).update(updates);
    } else {
        const updated = mixtapes.map(m => m.id === mixtapeId ? { ...m, ...updates } : m);
        setMixtapes(updated);
        await AsyncStorage.setItem(`mixtapes_${activeProfileKey}`, JSON.stringify(updated));
    }
  };

  const deleteMixtape = async (mixtapeId) => {
      if (!activeProfileKey) return;
      if (user && !isGuest) {
          await db.collection('users').doc(user.uid).collection('profiles').doc(activeProfileKey).collection('mixtapes').doc(mixtapeId).delete();
      } else {
          const updated = mixtapes.filter(m => m.id !== mixtapeId);
          setMixtapes(updated);
          await AsyncStorage.setItem(`mixtapes_${activeProfileKey}`, JSON.stringify(updated));
      }
  };

  return (
    <LibraryContext.Provider value={{ 
        watchlist, history, mixtapes, 
        toggleWatchlist, isInWatchlist, addToHistory, removeFromHistory,
        createMixtape, toggleInMixtape, updateMixtapeStyle, deleteMixtape 
    }}>
        {children}
    </LibraryContext.Provider>
  );
};