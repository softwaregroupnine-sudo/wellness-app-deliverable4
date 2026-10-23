import React, { useState, useEffect, useRef } from 'react';
import {
  View,
  Text,
  TextInput,
  Pressable,
  StyleSheet,
  Alert,
  ActivityIndicator,
  Image,
  StatusBar,
  ScrollView,
  KeyboardAvoidingView,
  Platform,
  useWindowDimensions,
  Animated,
} from 'react-native';
import Svg, {
  Defs,
  RadialGradient,
  Stop,
  Rect,
  Path,
} from 'react-native-svg';

import { loginUser, requestPasswordReset } from '../services/api';
import { saveSession, loadSession } from '../utils/session';

const COLORS = {
  cream: '#FCFBF5',
  sage: '#E1E9DC',
  darkGreen: '#354B35',
  navy: '#202A25',
  mutedGreen: '#758176',
  border: '#DCE2D9',
  orange: '#C8784F',
  white: '#FFFFFF',
};

function BackgroundArtwork() {
  return (
    <View style={StyleSheet.absoluteFill} pointerEvents="none">
      <Svg
        width="100%"
        height="100%"
        style={StyleSheet.absoluteFill}
      >
        <Defs>
          <RadialGradient
            id="backgroundGradient"
            cx="50%"
            cy="10%"
            rx="100%"
            ry="100%"
            gradientUnits="objectBoundingBox"
          >
            <Stop offset="0%" stopColor={COLORS.cream} />
            <Stop offset="55%" stopColor="#F0F2E9" />
            <Stop offset="100%" stopColor={COLORS.sage} />
          </RadialGradient>
        </Defs>

        <Rect
          width="100%"
          height="100%"
          fill="url(#backgroundGradient)"
        />

        <Path
          d="M0 0 C120 35 230 -5 360 20 C500 45 650 -5 800 20 L800 100 L0 100 Z"
          fill="#C7D7C2"
          opacity="0.55"
          transform="translate(0 830)"
        />
      </Svg>

      <Svg
        width="40%"
        height="34%"
        viewBox="0 0 160 240"
        style={styles.decorativeLeaves}
      >
        <Path
          d="M0 240 Q15 175 45 125 Q25 190 0 240"
          fill="#718C69"
        />
        <Path
          d="M15 220 Q5 150 35 95 Q50 160 15 220"
          fill="#8DA783"
        />
        <Path
          d="M12 195 Q45 125 82 118 Q68 165 12 195"
          fill="#577A54"
        />
        <Path
          d="M22 160 Q35 90 72 55 Q78 112 22 160"
          fill="#77956E"
        />
        <Path
          d="M30 135 Q72 82 110 85 Q91 126 30 135"
          fill="#9CB393"
        />
        <Path
          d="M0 225 Q55 190 100 200 Q65 232 0 225"
          fill="#64845E"
        />
        <Path
          d="M45 240 Q75 175 125 158 Q112 208 45 240"
          fill="#809B76"
        />
        <Path
          d="M15 235 Q48 178 82 165"
          fill="none"
          stroke="#4E704B"
          strokeWidth="2"
        />
      </Svg>
    </View>
  );
}

function LotusDivider() {
  return (
    <View style={styles.dividerRow}>
      <View style={styles.dividerLine} />

      <Svg width={28} height={25} viewBox="0 0 28 25">
        <Path
          d="M14 21 Q3 17 5 8 Q12 10 14 21"
          fill="#80977A"
        />
        <Path
          d="M14 21 Q25 17 23 8 Q16 10 14 21"
          fill="#80977A"
        />
        <Path
          d="M14 20 Q7 12 14 3 Q21 12 14 20"
          fill="#A1B497"
        />
        <Path
          d="M5 21 Q14 17 23 21"
          fill="none"
          stroke="#80977A"
          strokeWidth={1.5}
        />
      </Svg>

      <View style={styles.dividerLine} />
    </View>
  );
}

export default function LoginScreen({ navigation }) {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);

  // True while we check for a saved login when the app opens.
  const [checkingSession, setCheckingSession] = useState(true);

  const { height } = useWindowDimensions();

  // Animation values for the logo.
  const logoOpacity = useRef(
    new Animated.Value(0)
  ).current;

  const logoTranslateY = useRef(
    new Animated.Value(8)
  ).current;

  // If the student logged in before, skip this screen.
  useEffect(() => {
    let active = true;

    async function restoreSession() {
      const savedUser = await loadSession();

      if (!active) return;

      if (savedUser) {
        navigation.replace('MainApp', { user: savedUser });
      } else {
        setCheckingSession(false);
      }
    }

    restoreSession();

    return () => {
      active = false;
    };
  }, [navigation]);

  // Preload the local logo.
  useEffect(() => {
    const logo = Image.resolveAssetSource(
      require('../Logos/wellness_logo.png')
    );

    if (logo?.uri) {
      Image.prefetch(logo.uri).catch(() => {
        // The logo can still render normally if preloading fails.
      });
    }
  }, []);

  // Fade the logo in when it has loaded.
  const animateLogo = () => {
    Animated.parallel([
      Animated.timing(logoOpacity, {
        toValue: 1,
        duration: 700,
        useNativeDriver: true,
      }),
      Animated.timing(logoTranslateY, {
        toValue: 0,
        duration: 700,
        useNativeDriver: true,
      }),
    ]).start();
  };

  const handleLogin = async () => {
    if (!email.trim() || !password) {
      Alert.alert(
        'Missing details',
        'Please enter your email and password.'
      );
      return;
    }

    try {
      setLoading(true);

      const user = await loginUser(email.trim(), password);

      // Remember the user so the next app launch skips the login screen.
      await saveSession(user);

      navigation.replace('MainApp', { user });
    } catch (error) {
      Alert.alert(
        'Login failed',
        error.message || 'Unable to log in. Please try again.'
      );
    } finally {
      setLoading(false);
    }
  };

  const handleForgotPassword = async () => {
    if (loading) return;

    if (!email.trim()) {
      Alert.alert(
        'Enter your email',
        'Type your email address in the box above, then tap "Forgot password?" again.'
      );
      return;
    }

    try {
      setLoading(true);

      await requestPasswordReset(email.trim());

      Alert.alert(
        'Check your email',
        'If an account exists for that email, we have sent a link to reset your password. The link is valid for 30 minutes.'
      );
    } catch (error) {
      Alert.alert(
        'Could not send email',
        error.message || 'Please check your connection and try again.'
      );
    } finally {
      setLoading(false);
    }
  };

  // Show a plain loading view while the saved login is checked, so the
  // login form does not flash before the Dashboard opens.
  if (checkingSession) {
    return (
      <View
        style={[styles.screen, { alignItems: 'center', justifyContent: 'center' }]}
      >
        <ActivityIndicator size="large" color={COLORS.darkGreen} />
      </View>
    );
  }

  return (
    <View style={styles.screen}>
      <StatusBar hidden />

      <BackgroundArtwork />

      <KeyboardAvoidingView
        style={styles.keyboardContainer}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        <ScrollView
          showsVerticalScrollIndicator={false}
          keyboardShouldPersistTaps="handled"
          contentContainerStyle={[
            styles.content,
            { paddingTop: Math.max(35, height * 0.105) },
          ]}
        >
          {/* Animated logo */}
          <Animated.View
            style={[
              styles.logoContainer,
              {
                opacity: logoOpacity,
                transform: [
                  { translateY: logoTranslateY },
                ],
              },
            ]}
          >
            <Image
              source={require('../Logos/wellness_logo.png')}
              style={styles.logo}
              resizeMode="contain"
              accessibilityLabel="Wellness Support logo"
              onLoad={animateLogo}
            />
          </Animated.View>

          {/* Heading */}
          <View style={styles.headingContainer}>
            <Text style={styles.title}>Welcome back</Text>
            <Text style={styles.subtitle}>
              Sign in to continue
            </Text>
          </View>

          {/* Login card */}
          <View style={styles.card}>
            <Text style={styles.label}>Email</Text>

            <TextInput
              style={styles.input}
              value={email}
              onChangeText={setEmail}
              keyboardType="email-address"
              autoCapitalize="none"
              autoCorrect={false}
              autoComplete="email"
              textContentType="emailAddress"
              editable={!loading}
              returnKeyType="next"
              accessibilityLabel="Email address"
            />

            <Text style={[styles.label, styles.passwordLabel]}>
              Password
            </Text>

            <TextInput
              style={styles.input}
              value={password}
              onChangeText={setPassword}
              secureTextEntry
              autoCapitalize="none"
              autoComplete="current-password"
              textContentType="password"
              editable={!loading}
              returnKeyType="go"
              onSubmitEditing={handleLogin}
              accessibilityLabel="Password"
            />

            <Pressable
              style={({ pressed }) => [
                styles.loginButton,
                pressed && !loading && styles.buttonPressed,
                loading && styles.buttonDisabled,
              ]}
              onPress={handleLogin}
              disabled={loading}
              accessibilityRole="button"
            >
              {loading ? (
                <ActivityIndicator color={COLORS.white} />
              ) : (
                <Text style={styles.loginButtonText}>
                  Log in
                </Text>
              )}
            </Pressable>
          </View>

          {/* Password recovery */}
          <Pressable
            onPress={handleForgotPassword}
            disabled={loading}
            hitSlop={8}
            accessibilityRole="button"
          >
            <Text style={styles.forgotPassword}>
              Forgot password?
            </Text>
          </Pressable>

          {/* Divider */}
          <LotusDivider />

          {/* Registration link */}
          <View style={styles.signupRow}>
            <Text style={styles.signupText}>
              Don’t have an account?{' '}
            </Text>

            <Pressable
              onPress={() => navigation.navigate('Register')}
              disabled={loading}
              hitSlop={6}
              accessibilityRole="button"
            >
              <Text style={styles.registerText}>
                Register
              </Text>
            </Pressable>
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: COLORS.sage,
  },

  keyboardContainer: {
    flex: 1,
  },

  content: {
    flexGrow: 1,
    paddingHorizontal: 24,
    paddingBottom: 28,
  },

  logoContainer: {
    height: 76,
    alignItems: 'center',
    justifyContent: 'center',
  },

  logo: {
    width: 76,
    height: 76,
  },

  headingContainer: {
    alignItems: 'center',
    marginTop: 25,
    marginBottom: 26,
  },

  title: {
    color: COLORS.navy,
    fontSize: 30,
    fontWeight: '800',
    textAlign: 'center',
    letterSpacing: -0.5,
  },

  subtitle: {
    color: COLORS.darkGreen,
    fontSize: 15,
    fontWeight: '700',
    textAlign: 'center',
    marginTop: 7,
  },

  card: {
    backgroundColor: COLORS.white,
    borderRadius: 25,
    paddingHorizontal: 22,
    paddingTop: 23,
    paddingBottom: 24,
    shadowColor: '#26382A',
    shadowOffset: { width: 0, height: 7 },
    shadowOpacity: 0.09,
    shadowRadius: 15,
    elevation: 5,
  },

  label: {
    color: COLORS.navy,
    fontSize: 13,
    fontWeight: '700',
    marginBottom: 8,
  },

  passwordLabel: {
    marginTop: 19,
  },

  input: {
    height: 48,
    borderWidth: 1,
    borderColor: COLORS.border,
    borderRadius: 12,
    paddingHorizontal: 14,
    color: COLORS.navy,
    backgroundColor: '#FEFEFC',
    fontSize: 15,
  },

  loginButton: {
    height: 50,
    borderRadius: 13,
    backgroundColor: COLORS.darkGreen,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 25,
  },

  loginButtonText: {
    color: COLORS.white,
    fontSize: 16,
    fontWeight: '800',
  },

  buttonPressed: {
    opacity: 0.85,
  },

  buttonDisabled: {
    opacity: 0.7,
  },

  forgotPassword: {
    color: COLORS.mutedGreen,
    textAlign: 'center',
    fontSize: 13,
    fontWeight: '600',
    marginTop: 21,
  },

  dividerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 18,
    paddingHorizontal: 22,
  },

  dividerLine: {
    flex: 1,
    height: 1,
    backgroundColor: '#C8D2C4',
  },

  signupRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    flexWrap: 'wrap',
    marginTop: 17,
  },

  signupText: {
    color: COLORS.navy,
    fontSize: 13,
    fontWeight: '500',
  },

  registerText: {
    color: COLORS.orange,
    fontSize: 13,
    fontWeight: '800',
  },

  decorativeLeaves: {
    position: 'absolute',
    left: 0,
    bottom: 0,
    zIndex: -1,
  },
});