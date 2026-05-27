// src/screens/AuthScreen.js
import React, { useState, useEffect, useContext, useRef, memo } from 'react';
import { 
  View, Text, StyleSheet, TextInput, TouchableOpacity, 
  KeyboardAvoidingView, Platform, ActivityIndicator, Keyboard, ScrollView, Animated, Dimensions
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import MaskedView from '@react-native-masked-view/masked-view'; 
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import * as Linking from 'expo-linking'; 
import { ThemeContext } from '../context/ThemeContext';
import { AuthContext } from '../context/AuthContext';

const { width, height } = Dimensions.get('window');

// 100% Static Background for maximum keyboard stability
const ObsidianMeshBackground = memo(() => (
  <View style={StyleSheet.absoluteFill}>
    <LinearGradient colors={['#020204', '#050a14', '#000000']} style={StyleSheet.absoluteFill} />
    <View style={[styles.glowOrb, { top: -width * 0.4, left: -width * 0.2, backgroundColor: 'rgba(8, 253, 237, 0.08)' }]} />
    <View style={[styles.glowOrb, { bottom: -width * 0.3, right: -width * 0.3, backgroundColor: 'rgba(106, 231, 14, 0.06)' }]} />
    <View style={[styles.glowOrb, { top: height * 0.3, right: -width * 0.4, backgroundColor: 'rgba(0, 114, 237, 0.05)' }]} />
  </View>
));

// 🔥 ISOLATED GRADIENT HEADER
// Wrapped in memo() so it never re-renders or recalculates the mask when you type!
const AuthHeader = memo(() => {
  return (
    <View style={styles.headerContainer}>
      {Platform.OS === 'web' ? (
        <Text
          style={[
            styles.logoText,
            {
              backgroundImage: 'linear-gradient(90deg, #6ae70e 0%, #08fded 20%, #0072ed 60%)',
              WebkitBackgroundClip: 'text',
              WebkitTextFillColor: 'transparent',
              textShadowColor: 'transparent', // Overrides muddy web shadow
              textShadowOffset: { width: 0, height: 0 },
              textShadowRadius: 0
            },
          ]}
        >
          Nuvix+
        </Text>
      ) : (
        <View 
          style={{ height: 85, width: 300, justifyContent: 'center', alignItems: 'center', marginBottom: 5 }}
          shouldRasterizeIOS={true} 
          rasterizationScale={Dimensions.get('window').scale}
        >
          <MaskedView 
            style={{ flex: 1, width: '100%', height: '100%' }}
            maskElement={
              <View style={{ flex: 1, backgroundColor: 'transparent', justifyContent: 'center', alignItems: 'center' }}>
                <Text style={[styles.logoText, { marginBottom: 0 }]}>Nuvix+</Text>
              </View>
            }
          >
            <LinearGradient
              colors={['#6ae70e', '#08fded', '#0072ed']}
              locations={[0, 0.2, 0.6]}
              start={{ x: 0, y: 0 }} 
              end={{ x: 1, y: 0 }}
              style={{ flex: 1 }}
            />
          </MaskedView>
        </View>
      )}
      <Text style={styles.tagline}>Unlock the universe of cinema.</Text>
    </View>
  );
});

export default function AuthScreen() {
  const { theme } = useContext(ThemeContext);
  const { login, signup, resetPassword, loginAsGuest, verifyEmailCode, confirmNewPassword } = useContext(AuthContext);
  const insets = useSafeAreaInsets();

  const [mode, setMode] = useState('login'); 
  const [resetCode, setResetCode] = useState(null); 
  const processedCodes = useRef(new Set()); 
  
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [successMsg, setSuccessMsg] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [focusedInput, setFocusedInput] = useState(null);

  const [countdown, setCountdown] = useState(5);
  const pulseAnim = useRef(new Animated.Value(1)).current;
  const fadeAnim = useRef(new Animated.Value(0)).current;

  // Fade In Animation for Form Changes
  useEffect(() => {
    fadeAnim.setValue(0);
    Animated.timing(fadeAnim, { toValue: 1, duration: 500, useNativeDriver: true }).start();
  }, [mode]);

  // Verification Screen Countdown & Pulsing
  useEffect(() => {
    let interval;
    if (mode === 'verify_success') {
      Animated.loop(
        Animated.sequence([
          Animated.timing(pulseAnim, { toValue: 1.15, duration: 1000, useNativeDriver: true }),
          Animated.timing(pulseAnim, { toValue: 1, duration: 1000, useNativeDriver: true })
        ])
      ).start();

      setCountdown(5);
      interval = setInterval(() => {
        setCountdown((prev) => {
          if (prev <= 1) {
            clearInterval(interval);
            switchMode('login');
            setSuccessMsg('Email successfully verified! Welcome to Nuvix+.');
            return 0;
          }
          return prev - 1;
        });
      }, 1000);
    }
    return () => clearInterval(interval);
  }, [mode]);

  // UNIVERSAL DEEP LINK INTERCEPTOR
  useEffect(() => {
    let isMounted = true;

    const handleDeepLink = async (event) => {
      let url = typeof event === 'string' ? event : event?.url;
      if (!url) return;

      const parsedUrl = Linking.parse(url);
      const { queryParams } = parsedUrl;

      if (!queryParams || !queryParams.mode || !queryParams.oobCode) return;

      const linkMode = queryParams.mode;
      const oobCode = queryParams.oobCode;

      if (processedCodes.current.has(oobCode)) return;
      processedCodes.current.add(oobCode);

      if (linkMode === 'verifyEmail') {
        if (isMounted) setMode('verifying');
        try {
          await verifyEmailCode(oobCode);
          if (isMounted) setMode('verify_success');
        } catch (e) {
          if (isMounted) {
             setError('This link has expired or your email is already verified. Try logging in!');
             setMode('verify_error');
          }
        }
      } else if (linkMode === 'resetPassword') {
        if (isMounted) {
            setResetCode(oobCode);
            switchMode('reset');
        }
      }
    };

    Linking.getInitialURL().then(handleDeepLink);
    const subscription = Linking.addEventListener('url', handleDeepLink);
    
    return () => {
      isMounted = false;
      subscription.remove();
    };
  }, []);

  const switchMode = (newMode) => {
    setMode(newMode);
    setError('');
    setSuccessMsg('');
    setPassword('');
    setConfirmPassword('');
    setFocusedInput(null);
    if (newMode !== 'reset') setResetCode(null);
  };

  const handleAuthAction = async () => {
    Keyboard.dismiss();
    setError('');
    setSuccessMsg('');

    if (mode !== 'reset' && !email.trim()) {
      setError('Please enter your email address.');
      return;
    }

    setLoading(true);
    try {
      if (mode === 'login') {
        if (!password) { setError('Please enter your password.'); setLoading(false); return; }
        await login(email.trim(), password);

      } else if (mode === 'signup') {
        if (!password) { setError('Please enter a password.'); setLoading(false); return; }
        if (password !== confirmPassword) { setError('Passwords do not match.'); setLoading(false); return; }
        
        await signup(email.trim(), password);
        switchMode('login');
        setSuccessMsg('Account created! Please check your email to verify before signing in.');

      } else if (mode === 'forgot') {
        await resetPassword(email.trim());
        switchMode('login');
        setSuccessMsg('Password reset link sent! Please check your inbox.');
        
      } else if (mode === 'reset') {
        if (!password) { setError('Please enter a new password.'); setLoading(false); return; }
        if (password !== confirmPassword) { setError('Passwords do not match.'); setLoading(false); return; }
        if (password.length < 6) { setError('Password must be at least 6 characters.'); setLoading(false); return; }
        
        await confirmNewPassword(resetCode, password);
        switchMode('login');
        setSuccessMsg('Password reset successful! You can now sign in with your new password.');
      }
    } catch (err) {
      switch (err.code) {
        case 'auth/invalid-email': setError('Invalid email address format.'); break;
        case 'auth/user-not-found': setError('No account found with this email.'); break;
        case 'auth/wrong-password': setError('Incorrect password.'); break;
        case 'auth/email-already-in-use': setError('Email is already registered.'); break;
        case 'auth/password-does-not-meet-requirements': setError('Password must be at least 6 characters, including a number and a special character.'); break;
        case 'auth/weak-password': setError('Password must be at least 6 characters.'); break;
        case 'auth/invalid-credential': setError('Invalid credentials. Please try again.'); break;
        case 'auth/unverified-email': setError(err.message); break;
        case 'auth/invalid-action-code': setError('This link has expired or is invalid. Please request a new one.'); break;
        default: setError(err.message || 'An error occurred. Please try again.');
      }
    } finally {
      setLoading(false);
    }
  };

  const renderVerificationContent = () => {
    if (mode === 'verifying') {
      return (
        <View style={[styles.authCard, styles.centeredCard]}>
          <ActivityIndicator size="large" color="#08fded" style={{ marginBottom: 25 }} />
          <Text style={styles.title}>Verifying Identity</Text>
          <Text style={styles.subtitle}>Securing your connection to Nuvix+ servers...</Text>
        </View>
      );
    }

    if (mode === 'verify_success') {
      return (
        <View style={[styles.authCard, styles.centeredCard]}>
          <Animated.View style={[styles.successGlow, { transform: [{ scale: pulseAnim }] }]}>
             <Ionicons name="shield-checkmark" size={60} color="#08fded" />
          </Animated.View>
          <Text style={[styles.title, { marginTop: 25 }]}>Premiere Access Granted!</Text>
          <Text style={styles.subtitle}>Your cinematic journey begins now. Get ready to explore unlimited entertainment.</Text>
          <View style={styles.countdownBox}>
              <Text style={styles.countdownText}>Entering lobby in <Text style={{color: '#08fded', fontWeight: 'bold', fontSize: 18}}>{countdown}s</Text></Text>
          </View>
        </View>
      );
    }

    if (mode === 'verify_error') {
      return (
        <View style={[styles.authCard, styles.centeredCard]}>
          <Ionicons name="alert-circle" size={80} color="#ff4d4d" style={{ marginBottom: 15 }} />
          <Text style={styles.title}>Verification Failed</Text>
          <Text style={styles.errorTextLarge}>{error}</Text>
          <TouchableOpacity style={styles.outlineBtn} onPress={() => switchMode('login')}>
            <Text style={styles.outlineBtnText}>Return to Login</Text>
          </TouchableOpacity>
        </View>
      );
    }

    return null;
  };

  return (
    <View style={styles.container}>
      
      <ObsidianMeshBackground />

      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={styles.keyboardView}>
        <ScrollView 
            contentContainerStyle={[styles.scrollContent, { paddingTop: insets.top + 30 }]} 
            keyboardShouldPersistTaps="handled" 
            showsVerticalScrollIndicator={false}
        >
          
          <AuthHeader />

          {['verifying', 'verify_success', 'verify_error'].includes(mode) ? renderVerificationContent() : (

            <Animated.View style={[styles.authCard, { opacity: fadeAnim }]}>
              <Text style={styles.title}>
                {mode === 'login' ? 'Welcome Back' : mode === 'signup' ? 'Join Nuvix+' : mode === 'reset' ? 'Set New Password' : 'Recover Account'}
              </Text>

              {successMsg ? (
                  <View style={styles.successBox}>
                      <Ionicons name="checkmark-circle" size={20} color="#4caf50" style={{ marginRight: 8 }} />
                      <Text style={styles.successText}>{successMsg}</Text>
                  </View>
              ) : null}

              {error ? <Text style={styles.errorText}>{error}</Text> : null}

              {mode !== 'reset' && (
                <View style={[styles.inputWrapper, focusedInput === 'email' && styles.inputWrapperFocused]}>
                    <Ionicons name="mail-outline" size={20} color={focusedInput === 'email' ? '#08fded' : '#8e8e93'} style={styles.inputIcon} />
                    <TextInput
                        style={styles.input}
                        placeholder="Email Address"
                        placeholderTextColor="#666"
                        value={email}
                        onChangeText={(val) => { setEmail(val); setError(''); setSuccessMsg(''); }}
                        keyboardType="email-address"
                        autoCapitalize="none"
                        autoCorrect={false}
                        onFocus={() => setFocusedInput('email')}
                        onBlur={() => setFocusedInput(null)}
                    />
                </View>
              )}

              {mode !== 'forgot' && (
                <View style={[styles.inputWrapper, focusedInput === 'password' && styles.inputWrapperFocused]}>
                  <Ionicons name="lock-closed-outline" size={20} color={focusedInput === 'password' ? '#08fded' : '#8e8e93'} style={styles.inputIcon} />
                  <TextInput
                    style={styles.input}
                    placeholder={mode === 'reset' ? "New Password" : "Password"}
                    placeholderTextColor="#666"
                    value={password}
                    onChangeText={(val) => { setPassword(val); setError(''); }}
                    secureTextEntry={!showPassword}
                    autoCapitalize="none"
                    onFocus={() => setFocusedInput('password')}
                    onBlur={() => setFocusedInput(null)}
                  />
                  <TouchableOpacity activeOpacity={0.8} onPress={() => setShowPassword(!showPassword)} style={styles.eyeIcon}>
                    <Ionicons name={showPassword ? "eye-off" : "eye"} size={20} color="#8e8e93" />
                  </TouchableOpacity>
                </View>
              )}

              {(mode === 'signup' || mode === 'reset') && (
                <View style={[styles.inputWrapper, focusedInput === 'confirm' && styles.inputWrapperFocused]}>
                  <Ionicons name="shield-checkmark-outline" size={20} color={focusedInput === 'confirm' ? '#08fded' : '#8e8e93'} style={styles.inputIcon} />
                  <TextInput
                    style={styles.input}
                    placeholder={mode === 'reset' ? "Confirm New Password" : "Confirm Password"}
                    placeholderTextColor="#666"
                    value={confirmPassword}
                    onChangeText={(val) => { setConfirmPassword(val); setError(''); }}
                    secureTextEntry={!showPassword}
                    autoCapitalize="none"
                    onFocus={() => setFocusedInput('confirm')}
                    onBlur={() => setFocusedInput(null)}
                  />
                </View>
              )}

              {mode === 'login' && (
                  <TouchableOpacity style={styles.forgotBtn} onPress={() => switchMode('forgot')}>
                      <Text style={styles.forgotText}>Forgot Password?</Text>
                  </TouchableOpacity>
              )}

              <TouchableOpacity activeOpacity={0.8} style={{ marginTop: 10 }} onPress={handleAuthAction} disabled={loading}>
                <LinearGradient colors={loading ? ['#333', '#333'] : ['#08fded', '#0072ed']} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={styles.submitBtn}>
                  {loading ? <ActivityIndicator color="#000" /> : <Text style={styles.submitBtnText}>{mode === 'login' ? 'Sign In' : mode === 'signup' ? 'Create Account' : mode === 'reset' ? 'Save Password' : 'Send Reset Link'}</Text>}
                </LinearGradient>
              </TouchableOpacity>

              <View style={styles.footerLinks}>
                  {mode === 'forgot' || mode === 'reset' ? (
                      <TouchableOpacity onPress={() => switchMode('login')} style={styles.footerLinkRow}>
                          <Ionicons name="arrow-back" size={16} color="#8e8e93" style={{ marginRight: 6 }} />
                          <Text style={styles.footerLinkTextAction}>Return to Sign In</Text>
                      </TouchableOpacity>
                  ) : (
                      <View style={styles.footerLinkRow}>
                          <Text style={styles.footerLinkTextBase}>{mode === 'login' ? "New to Nuvix+?" : "Already have an account?"}</Text>
                          <TouchableOpacity onPress={() => switchMode(mode === 'login' ? 'signup' : 'login')}>
                              <Text style={styles.footerLinkTextActionHighlight}>{mode === 'login' ? ' Sign up' : ' Sign in'}</Text>
                          </TouchableOpacity>
                      </View>
                  )}
              </View>
            </Animated.View>
          )}

          {!['verifying', 'verify_success'].includes(mode) && (
            <TouchableOpacity style={styles.guestBtn} onPress={loginAsGuest}>
              <Text style={styles.guestBtnText}>Explore as Guest</Text>
              <Ionicons name="chevron-forward" size={16} color="#8e8e93" style={{marginLeft: 4, marginTop: 2}}/>
            </TouchableOpacity>
          )}

        </ScrollView>
      </KeyboardAvoidingView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#020204' },
  
  glowOrb: { position: 'absolute', width: width * 1.5, height: width * 1.5, borderRadius: width * 0.75, filter: 'blur(120px)' },

  keyboardView: { flex: 1 },
  scrollContent: { flexGrow: 1, justifyContent: 'center', alignItems: 'center', paddingBottom: 60, paddingHorizontal: 20 },
  
  headerContainer: { alignItems: 'center', marginBottom: 40 },
  logoText: { 
      fontFamily: 'Fredoka_700Bold', 
      fontSize: 65, 
      letterSpacing: 1.5, 
      marginBottom: 5, 
      textShadowColor: 'rgba(0, 0, 0, 0.8)', 
      textShadowOffset: { width: 0, height: 4 }, 
      textShadowRadius: 10 
  },
  tagline: { color: '#a1a1aa', fontSize: 16, fontWeight: '500', letterSpacing: 0.5 },
  
  authCard: { 
      width: '100%', 
      maxWidth: 420, 
      borderRadius: 24, 
      padding: 35, 
      backgroundColor: 'rgba(255, 255, 255, 0.03)', 
      borderWidth: 1,
      borderColor: 'rgba(255, 255, 255, 0.06)',
  },
  centeredCard: { alignItems: 'center', paddingVertical: 50 },
  
  title: { fontSize: 26, fontWeight: '800', color: '#fff', marginBottom: 30, letterSpacing: 0.5 },
  subtitle: { fontSize: 15, color: '#a1a1aa', textAlign: 'center', marginBottom: 20, lineHeight: 24, paddingHorizontal: 10 },
  
  inputWrapper: { 
      flexDirection: 'row', 
      alignItems: 'center', 
      height: 60, 
      backgroundColor: 'rgba(0,0,0,0.4)', 
      borderRadius: 14, 
      borderWidth: 1.5,
      borderColor: 'rgba(255, 255, 255, 0.05)',
      marginBottom: 16,
      paddingHorizontal: 18
  },
  inputWrapperFocused: {
      borderColor: '#08fded',
      backgroundColor: 'rgba(8, 253, 237, 0.05)',
  },
  inputIcon: { marginRight: 12 },
  input: { flex: 1, height: '100%', fontSize: 16, color: '#fff', fontWeight: '500' },
  eyeIcon: { padding: 10 },
  
  errorText: { color: '#ff4d4d', fontSize: 13, marginBottom: 20, fontWeight: '600', marginTop: -5, marginLeft: 5 },
  errorTextLarge: { color: '#ff4d4d', fontSize: 15, textAlign: 'center', marginBottom: 30, fontWeight: '500', lineHeight: 22 },
  
  successBox: { flexDirection: 'row', backgroundColor: 'rgba(76, 175, 80, 0.15)', padding: 16, borderRadius: 12, marginBottom: 20, borderWidth: 1, borderColor: 'rgba(76, 175, 80, 0.4)' },
  successText: { color: '#4caf50', fontSize: 14, fontWeight: '600', flex: 1, lineHeight: 20 },

  forgotBtn: { alignSelf: 'flex-end', marginBottom: 30, marginTop: -5 },
  forgotText: { color: '#a1a1aa', fontSize: 14, fontWeight: '600' },
  
  submitBtn: { height: 60, borderRadius: 30, justifyContent: 'center', alignItems: 'center', shadowColor: '#08fded', shadowOffset: { width: 0, height: 6 }, shadowOpacity: 0.3, shadowRadius: 15 },
  submitBtnText: { fontSize: 18, fontWeight: '800', letterSpacing: 0.5, color: '#000' },

  outlineBtn: { height: 55, width: '100%', borderRadius: 28, justifyContent: 'center', alignItems: 'center', borderWidth: 1.5, borderColor: 'rgba(255,255,255,0.3)', marginTop: 10 },
  outlineBtnText: { fontSize: 16, fontWeight: '700', color: '#fff', letterSpacing: 0.5 },
  
  footerLinks: { marginTop: 35, alignItems: 'center' },
  footerLinkRow: { flexDirection: 'row', alignItems: 'center' },
  footerLinkTextBase: { color: '#a1a1aa', fontSize: 15, fontWeight: '500' },
  footerLinkTextAction: { color: '#fff', fontSize: 15, fontWeight: '800' },
  footerLinkTextActionHighlight: { color: '#08fded', fontSize: 15, fontWeight: '800' },

  guestBtn: { flexDirection: 'row', alignItems: 'center', marginTop: 45, paddingVertical: 14, paddingHorizontal: 25, backgroundColor: 'rgba(255,255,255,0.05)', borderRadius: 30, borderWidth: 1, borderColor: 'rgba(255,255,255,0.1)' },
  guestBtnText: { color: '#e4e4e7', fontSize: 16, fontWeight: '700', letterSpacing: 0.5 },

  successGlow: {
      width: 130, height: 130, borderRadius: 65,
      backgroundColor: 'rgba(8, 253, 237, 0.1)',
      justifyContent: 'center', alignItems: 'center',
      borderWidth: 2, borderColor: 'rgba(8, 253, 237, 0.4)',
  },
  countdownBox: {
      marginTop: 20, paddingVertical: 12, paddingHorizontal: 25,
      backgroundColor: 'rgba(255,255,255,0.05)', borderRadius: 30,
      borderWidth: 1, borderColor: 'rgba(255,255,255,0.1)'
  },
  countdownText: { color: '#e4e4e7', fontSize: 15, fontWeight: '500' }
});