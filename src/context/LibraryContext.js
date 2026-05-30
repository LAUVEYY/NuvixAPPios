// src/context/LibraryContext.js
import React, { createContext, useState, useEffect, useContext, useRef } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import firebase from 'firebase/compat/app';
import 'firebase/compat/firestore';
import { AuthContext } from './AuthContext';

export const LibraryContext = createContext();

export const LibraryProvider = ({ children }) => {
  const { user, isGuest, activeProfileKey, profiles, activeProfile } = useContext(AuthContext);
  
  const [watchlist, setWatchlist] = useState([]);
  const [history, setHistory] = useState([]);
  
  const [localMixtapes, setLocalMixtapes] = useState([]); 
  const [collabUpdates, setCollabUpdates] = useState({});
  const collabListenersRef = useRef({});
  const toggleLockRef = useRef(new Set()); 
  
  const db = firebase.firestore();

  useEffect(() => {
    if (!activeProfileKey) {
        setWatchlist([]);
        setHistory([]);
        setLocalMixtapes([]);
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
                setLocalMixtapes(mixData);
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

                const cachedMixtapes = await AsyncStorage.getItem(`mixtapes_${activeProfileKey}`);
                if (cachedMixtapes) setLocalMixtapes(JSON.parse(cachedMixtapes));

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

  useEffect(() => {
      if (!user || isGuest) return;
      
      const currentCollabIds = localMixtapes
          .filter(m => m.isCollaborative && m.sharedPublicId)
          .map(m => m.sharedPublicId);

      currentCollabIds.forEach(pubId => {
          if (!collabListenersRef.current[pubId]) {
              collabListenersRef.current[pubId] = db.collection('public_mixtapes').doc(pubId).onSnapshot(snap => {
                  if (snap.exists) {
                      setCollabUpdates(prev => ({ ...prev, [pubId]: snap.data() }));
                  }
              }, err => console.error(`Error listening to public mix ${pubId}:`, err));
          }
      });

      Object.keys(collabListenersRef.current).forEach(pubId => {
          if (!currentCollabIds.includes(pubId)) {
              collabListenersRef.current[pubId](); 
              delete collabListenersRef.current[pubId];
          }
      });
  }, [localMixtapes, user, isGuest]);

  useEffect(() => {
      return () => {
          Object.values(collabListenersRef.current).forEach(unsub => unsub());
      };
  }, []);

  const mixtapes = localMixtapes.map(mix => {
      if (mix.isCollaborative && mix.sharedPublicId && collabUpdates[mix.sharedPublicId]) {
          const pubData = collabUpdates[mix.sharedPublicId];
          return {
              ...mix,
              ...pubData, 
              id: mix.id, 
              sharedPublicId: mix.sharedPublicId,
              watchSharedId: mix.watchSharedId || null,
              isImported: mix.isImported
          };
      }
      return mix;
  });

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

  const createMixtape = async (title, description = '') => {
    if (!activeProfileKey || !title.trim()) return;
    const newId = Date.now().toString();
    
    const ownerColorFallback = activeProfile?.avatarColor || '#0072ed';
    const ownerImageFallback = activeProfile?.avatarImage || activeProfile?.avatar || activeProfile?.photoURL || null;

    const newMixtape = { 
        id: newId, 
        title: title.trim(), 
        description: description.trim(), 
        items: [], 
        coverStyle: 'mosaic', 
        customCoverImage: null, 
        sharedPublicId: null, 
        watchSharedId: null,
        isImported: false,
        isCollaborative: false, 
        editors: user ? [user.uid] : [], 
        collaborators: [],
        originalOwner: null,
        ownerColor: ownerColorFallback,
        ownerImage: ownerImageFallback,
        ownerUid: user ? user.uid : null,
        createdAt: Date.now() 
    };

    if (user && !isGuest) {
        await db.collection('users').doc(user.uid).collection('profiles').doc(activeProfileKey).collection('mixtapes').doc(newId).set(newMixtape);
    } else {
        const updated = [newMixtape, ...localMixtapes];
        setLocalMixtapes(updated);
        await AsyncStorage.setItem(`mixtapes_${activeProfileKey}`, JSON.stringify(updated));
    }
  };

  const toggleInMixtape = async (mixtapeId, item) => {
    if (!activeProfileKey) return;
    
    const lockKey = `${mixtapeId}_${item.id}`;
    if (toggleLockRef.current.has(lockKey)) return; 
    toggleLockRef.current.add(lockKey);

    try {
        const targetMix = mixtapes.find(m => m.id === mixtapeId);
        if (!targetMix) return;

        const currentActiveProfile = profiles ? profiles.find(p => p.key === activeProfileKey) : null;
        const itemType = item.type || item.media_type || (item.name && !item.title ? 'tv' : 'movie');
        
        const itemData = {
            id: item.id, type: itemType, title: item.title || item.name,
            poster_path: item.poster_path || null, backdrop_path: item.backdrop_path || null,
            vote_average: item.vote_average || 0, release_date: item.release_date || item.first_air_date || null,
            addedByUid: user ? user.uid : 'guest',
            addedByProfileKey: activeProfileKey || null, 
            addedByName: currentActiveProfile?.name || 'Curator',
            addedByPic: currentActiveProfile?.avatarImage || currentActiveProfile?.avatar || null,
            addedByColor: currentActiveProfile?.avatarColor || '#0072ed',
            addedAt: Date.now()
        };

        if (user && !isGuest && targetMix.isCollaborative && targetMix.sharedPublicId) {
            const pubRef = db.collection('public_mixtapes').doc(targetMix.sharedPublicId);
            let finalItems = [];
            
            await db.runTransaction(async (transaction) => {
                const pubDoc = await transaction.get(pubRef);
                if (pubDoc.exists) {
                    let pubItems = [...(pubDoc.data().items || [])];
                    const existingIndex = pubItems.findIndex(i => i.id === item.id);
                    if (existingIndex >= 0) pubItems.splice(existingIndex, 1);
                    else pubItems.unshift(itemData);
                    transaction.update(pubRef, { items: pubItems });
                    finalItems = pubItems;
                }
            });

            if (finalItems.length > 0) {
                 await db.collection('users').doc(user.uid).collection('profiles').doc(activeProfileKey).collection('mixtapes').doc(mixtapeId).update({ items: finalItems });
                 // Sync read-only watch share if it exists
                 if (targetMix.watchSharedId) {
                     await db.collection('public_mixtapes').doc(targetMix.watchSharedId).update({ items: finalItems });
                 }
            }
        } else {
            let currentItems = [...targetMix.items];
            const existingIndex = currentItems.findIndex(i => i.id === item.id);
            if (existingIndex >= 0) currentItems.splice(existingIndex, 1);
            else currentItems.unshift(itemData);

            if (user && !isGuest) {
                await db.collection('users').doc(user.uid).collection('profiles').doc(activeProfileKey).collection('mixtapes').doc(mixtapeId).update({ items: currentItems });
                if (targetMix.sharedPublicId) {
                    await db.collection('public_mixtapes').doc(targetMix.sharedPublicId).update({ items: currentItems });
                }
                if (targetMix.watchSharedId) {
                    await db.collection('public_mixtapes').doc(targetMix.watchSharedId).update({ items: currentItems });
                }
            } else {
                const updated = localMixtapes.map(m => m.id === mixtapeId ? { ...m, items: currentItems } : m);
                setLocalMixtapes(updated);
                await AsyncStorage.setItem(`mixtapes_${activeProfileKey}`, JSON.stringify(updated));
            }
        }
    } catch (err) {
        console.error("Error updating mixtape:", err);
    } finally {
        toggleLockRef.current.delete(lockKey);
    }
  };

  const updateMixtapeStyle = async (mixtapeId, style, customImage = null, newTitle = null, newDesc = null) => {
    if (!activeProfileKey) return;
    const updates = { coverStyle: style };
    if (customImage !== null) updates.customCoverImage = customImage;
    if (newTitle !== null) updates.title = newTitle;
    if (newDesc !== null) updates.description = newDesc;

    if (user && !isGuest) {
        await db.collection('users').doc(user.uid).collection('profiles').doc(activeProfileKey).collection('mixtapes').doc(mixtapeId).update(updates);
        const targetMix = mixtapes.find(m => m.id === mixtapeId);
        if (targetMix && targetMix.sharedPublicId) {
            await db.collection('public_mixtapes').doc(targetMix.sharedPublicId).update(updates);
        }
        if (targetMix && targetMix.watchSharedId) {
            await db.collection('public_mixtapes').doc(targetMix.watchSharedId).update(updates);
        }
    } else {
        const updated = localMixtapes.map(m => m.id === mixtapeId ? { ...m, ...updates } : m);
        setLocalMixtapes(updated);
        await AsyncStorage.setItem(`mixtapes_${activeProfileKey}`, JSON.stringify(updated));
    }
  };

  const deleteMixtape = async (mixtapeId) => {
      if (!activeProfileKey) return;
      if (user && !isGuest) {
          const targetMix = mixtapes.find(m => m.id === mixtapeId);
          await db.collection('users').doc(user.uid).collection('profiles').doc(activeProfileKey).collection('mixtapes').doc(mixtapeId).delete();
          if (targetMix && targetMix.sharedPublicId && !targetMix.isImported) {
              await db.collection('public_mixtapes').doc(targetMix.sharedPublicId).delete();
          }
          if (targetMix && targetMix.watchSharedId && !targetMix.isImported) {
              await db.collection('public_mixtapes').doc(targetMix.watchSharedId).delete();
          }
      } else {
          const updated = localMixtapes.filter(m => m.id !== mixtapeId);
          setLocalMixtapes(updated);
          await AsyncStorage.setItem(`mixtapes_${activeProfileKey}`, JSON.stringify(updated));
      }
  };

  const leaveCollaborativeMixtape = async (mixtapeId) => {
      if (!activeProfileKey || !user || isGuest) return;
      try {
          const targetMix = mixtapes.find(m => m.id === mixtapeId);
          if (!targetMix) return;

          await db.collection('users').doc(user.uid).collection('profiles').doc(activeProfileKey).collection('mixtapes').doc(mixtapeId).delete();

          if (targetMix.sharedPublicId && targetMix.isCollaborative) {
              const pubRef = db.collection('public_mixtapes').doc(targetMix.sharedPublicId);
              await db.runTransaction(async (transaction) => {
                  const pubDoc = await transaction.get(pubRef);
                  if (pubDoc.exists) {
                      const data = pubDoc.data();
                      const newEditors = (data.editors || []).filter(e => e !== user.uid);
                      const newCollabs = (data.collaborators || []).filter(c => !(c.uid === user.uid && c.profileKey === activeProfileKey));
                      transaction.update(pubRef, { editors: newEditors, collaborators: newCollabs });
                  }
              });
          }
      } catch (error) {
          console.error("Error leaving collaborative mixtape:", error);
      }
  };

  const shareMixtape = async (mixtapeId, title, items, isCollab = false) => {
      if (isGuest || !user || !activeProfileKey) return null;
      
      const targetMix = mixtapes.find(m => m.id === mixtapeId);
      if (!targetMix) return null;
      
      const currentActiveProfile = profiles.find(p => p.key === activeProfileKey);
      const ownerName = currentActiveProfile ? currentActiveProfile.name : 'Curator';
      const ownerPic = currentActiveProfile?.avatarImage || currentActiveProfile?.avatar || null;
      const ownerColor = currentActiveProfile?.avatarColor || '#0072ed';
      const ownerCollaboratorData = { uid: user.uid, profileKey: activeProfileKey, name: ownerName, pic: ownerPic, color: ownerColor };

      if (!isCollab && targetMix.isCollaborative) {
          if (targetMix.watchSharedId) {
              return targetMix.watchSharedId;
          }
      } 
      else if (targetMix.sharedPublicId) {
          if (targetMix.ownerUid && targetMix.ownerUid !== user.uid) {
              return targetMix.sharedPublicId;
          }

          if (!targetMix.isCollaborative && isCollab) {
              try {
                  await db.collection('public_mixtapes').doc(targetMix.sharedPublicId).update({
                      isCollaborative: true,
                      editors: firebase.firestore.FieldValue.arrayUnion(user.uid),
                      collaborators: firebase.firestore.FieldValue.arrayUnion(ownerCollaboratorData)
                  });
                  await db.collection('users').doc(user.uid).collection('profiles').doc(activeProfileKey).collection('mixtapes').doc(mixtapeId).update({
                      isCollaborative: true,
                      editors: [user.uid],
                      collaborators: [ownerCollaboratorData]
                  });
              } catch (e) {
                  console.error("Error updating collab status:", e);
              }
          }
          return targetMix.sharedPublicId; 
      }

      const publicId = `mix_${Date.now()}_${Math.random().toString(36).substr(2, 5)}`;
      
      const publicData = {
          ...targetMix,
          id: publicId, 
          originalId: targetMix.id,
          ownerUid: user.uid,
          ownerProfileKey: activeProfileKey,
          ownerName: ownerName,
          ownerImage: ownerPic,
          ownerColor: ownerColor,
          savedBy: [], 
          sharedAt: Date.now(),
          isCollaborative: isCollab,
          editors: isCollab ? [user.uid] : [],
          collaborators: isCollab ? [ownerCollaboratorData] : [] 
      };

      if (!isCollab && targetMix.isCollaborative) {
          publicData.isCollaborative = false;
          publicData.editors = [];
          publicData.collaborators = [];
      }

      try {
          await db.collection('public_mixtapes').doc(publicId).set(publicData);
          
          const updateData = {};
          if (isCollab) {
              updateData.sharedPublicId = publicId;
              updateData.isCollaborative = true;
              updateData.editors = [user.uid];
              updateData.collaborators = [ownerCollaboratorData];
          } else if (targetMix.isCollaborative) {
              updateData.watchSharedId = publicId;
          } else {
              updateData.sharedPublicId = publicId;
              updateData.isCollaborative = false;
          }

          await db.collection('users').doc(user.uid).collection('profiles').doc(activeProfileKey).collection('mixtapes').doc(mixtapeId).update(updateData);
          return publicId;
      } catch (error) {
          console.error("Error sharing mixtape globally:", error);
          return null;
      }
  };

  const fetchPublicMixtape = async (publicId) => {
      try {
          const doc = await db.collection('public_mixtapes').doc(publicId).get();
          if (doc.exists) return doc.data();
          return null;
      } catch (error) {
          console.error("Error fetching public mixtape:", error);
          return null;
      }
  };

  const joinCollaborativeMixtape = async (publicId) => {
      if (!activeProfileKey || !user || isGuest) return false;
      try {
          const doc = await db.collection('public_mixtapes').doc(publicId).get();
          if (!doc.exists) return false;
          
          const publicData = doc.data();

          if (!publicData.isCollaborative) {
              return await savePublicMixtape(publicId);
          }

          const currentActiveProfile = profiles.find(p => p.key === activeProfileKey);
          
          const newCollaborator = {
              uid: user.uid,
              profileKey: activeProfileKey,
              name: currentActiveProfile?.name || 'Curator',
              pic: currentActiveProfile?.avatarImage || currentActiveProfile?.avatar || null,
              color: currentActiveProfile?.avatarColor || '#0072ed'
          };

          await db.collection('public_mixtapes').doc(publicId).update({
              editors: firebase.firestore.FieldValue.arrayUnion(user.uid),
              collaborators: firebase.firestore.FieldValue.arrayUnion(newCollaborator)
          });

          const linkedCollabMix = {
              ...publicData,
              id: publicId, 
              sharedPublicId: publicId,
              isImported: true,
              isCollaborative: true,
              joinedAt: Date.now(),
              editors: [...(publicData.editors || []), user.uid],
              collaborators: [...(publicData.collaborators || []), newCollaborator] 
          };

          await db.collection('users').doc(user.uid).collection('profiles').doc(activeProfileKey).collection('mixtapes').doc(publicId).set(linkedCollabMix);
          return true;

      } catch (error) {
          console.error("Error joining collaborative mixtape:", error);
          return false;
      }
  };

  const savePublicMixtape = async (publicId) => {
      if (!activeProfileKey) return false;
      try {
          const doc = await db.collection('public_mixtapes').doc(publicId).get();
          if (!doc.exists) return false;

          const publicData = doc.data();
          const newPrivateId = Date.now().toString();
          
          const newPrivateMix = {
              id: newPrivateId,
              title: publicData.title,
              description: publicData.description,
              items: publicData.items,
              coverStyle: publicData.coverStyle,
              customCoverImage: publicData.customCoverImage || null,
              sharedPublicId: null, 
              createdAt: Date.now(),
              isImported: true,
              isCollaborative: false, 
              editors: user ? [user.uid] : [],
              collaborators: [],
              originalOwner: publicData.ownerName || null,
              ownerName: publicData.ownerName || null,
              ownerImage: publicData.ownerImage || null,
              ownerColor: publicData.ownerColor || null
          };

          if (user && !isGuest) {
              await db.collection('users').doc(user.uid).collection('profiles').doc(activeProfileKey).collection('mixtapes').doc(newPrivateId).set(newPrivateMix);
              
              const currentActiveProfile = profiles.find(p => p.key === activeProfileKey);
              const saverName = currentActiveProfile ? currentActiveProfile.name : 'Curator';

              await db.collection('public_mixtapes').doc(publicId).update({
                  savedBy: firebase.firestore.FieldValue.arrayUnion({
                      uid: user.uid,
                      profileKey: activeProfileKey,
                      name: saverName,
                      savedAt: Date.now()
                  })
              });
          } else {
              const updated = [newPrivateMix, ...localMixtapes];
              setLocalMixtapes(updated);
              await AsyncStorage.setItem(`mixtapes_${activeProfileKey}`, JSON.stringify(updated));
          }
          return true;
      } catch (error) {
          console.error("Error downloading public mixtape:", error);
          return false;
      }
  };

  return (
    <LibraryContext.Provider value={{ 
        watchlist, history, mixtapes, 
        toggleWatchlist, isInWatchlist, addToHistory, removeFromHistory,
        createMixtape, toggleInMixtape, updateMixtapeStyle, deleteMixtape,
        leaveCollaborativeMixtape, shareMixtape, fetchPublicMixtape, savePublicMixtape, joinCollaborativeMixtape
    }}>
        {children}
    </LibraryContext.Provider>
  );
};