
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

import { registerUser } from '../services/api';

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
            id="registerBackgroundGradient"
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
          fill="url(#registerBackgroundGradient)"
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

export default function RegisterScreen({ navigation }) {
  const [displayName, setDisplayName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [loading, setLoading] = useState(false);

  const { height } = useWindowDimensions();

  // Animation values for the logo.
  const logoOpacity = useRef(
    new Animated.Value(0)
  ).current;

  const logoTranslateY = useRef(
    new Animated.Value(8)
  ).current;

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

  // Fade the logo in after it loads.
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

  const handleRegister = async () => {
    if (
      !displayName.trim() ||
      !email.trim() ||
      !password ||
      !confirmPassword
    ) {
      Alert.alert(
        'Missing details',
        'Please complete all fields.'
      );
      return;
    }

    if (password.length < 8) {
      Alert.alert(
        'Password too short',
        'Your password must contain at least 8 characters.'
      );
      return;
    }

    // Check that both password fields match.
    if (password !== confirmPassword) {
      Alert.alert(
        'Passwords do not match',
        'Please make sure both password fields are identical.'
      );
      return;
    }

    try {
      setLoading(true);

      await registerUser(
        displayName.trim(),
        email.trim(),
        password
      );

      Alert.alert(
        'Account created',
        'Your account has been registered successfully.',
        [
          {
            text: 'Go to Login',
            onPress: () => navigation.navigate('Login'),
          },
        ]
      );
    } catch (error) {
      Alert.alert(
        'Registration failed',
        error.message || 'Unable to register. Please try again.'
      );
    } finally {
      setLoading(false);
    }
  };

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
            { paddingTop: Math.max(24, height * 0.055) },
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
            <Text style={styles.title}>
              Create your account
            </Text>

            <Text style={styles.subtitle}>
              Start your wellbeing journey
            </Text>
          </View>

          {/* Registration card */}
          <View style={styles.card}>
            <Text style={styles.label}>Name</Text>

            <TextInput
              style={styles.input}
              placeholder="Enter your name"
              placeholderTextColor="#9A9F97"
              value={displayName}
              onChangeText={setDisplayName}
              autoCapitalize="words"
              autoCorrect={false}
              autoComplete="name"
              textContentType="name"
              editable={!loading}
              returnKeyType="next"
              accessibilityLabel="Name"
            />

            <Text style={[styles.label, styles.fieldLabel]}>
              Email
            </Text>

            <TextInput
              style={styles.input}
              placeholder="Enter your email"
              placeholderTextColor="#9A9F97"
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

            <Text style={[styles.label, styles.fieldLabel]}>
              Password
            </Text>

            <TextInput
              style={styles.input}
              placeholder="At least 8 characters"
              placeholderTextColor="#9A9F97"
              value={password}
              onChangeText={setPassword}
              secureTextEntry
              autoCapitalize="none"
              autoComplete="new-password"
              textContentType="newPassword"
              editable={!loading}
              returnKeyType="next"
              accessibilityLabel="Password"
            />

            <Text style={[styles.label, styles.fieldLabel]}>
              Confirm password
            </Text>

            <TextInput
              style={styles.input}
              placeholder="Re-enter your password"
              placeholderTextColor="#9A9F97"
              value={confirmPassword}
              onChangeText={setConfirmPassword}
              secureTextEntry
              autoCapitalize="none"
              autoComplete="off"
              textContentType="newPassword"
              editable={!loading}
              returnKeyType="go"
              onSubmitEditing={handleRegister}
              accessibilityLabel="Confirm password"
            />

            {/* Register button */}
            <Pressable
              style={({ pressed }) => [
                styles.registerButton,
                pressed && !loading && styles.buttonPressed,
                loading && styles.buttonDisabled,
              ]}
              onPress={handleRegister}
              disabled={loading}
              accessibilityRole="button"
            >
              {loading ? (
                <ActivityIndicator color={COLORS.white} />
              ) : (
                <Text style={styles.registerButtonText}>
                  Register
                </Text>
              )}
            </Pressable>
          </View>

          {/* Login link */}
          <View style={styles.loginRow}>
            <Text style={styles.loginText}>
              Already have an account?{' '}
            </Text>

            <Pressable
              onPress={() => navigation.navigate('Login')}
              disabled={loading}
              hitSlop={6}
              accessibilityRole="button"
            >
              <Text style={styles.loginLink}>Log in</Text>
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
    marginTop: 17,
    marginBottom: 22,
  },

  title: {
    color: COLORS.navy,
    fontSize: 29,
    fontWeight: '800',
    textAlign: 'center',
    letterSpacing: -0.5,
  },

  subtitle: {
    color: COLORS.darkGreen,
    fontSize: 15,
    fontWeight: '500',
    textAlign: 'center',
    marginTop: 7,
  },

  card: {
    backgroundColor: COLORS.white,
    borderRadius: 25,
    paddingHorizontal: 22,
    paddingTop: 22,
    paddingBottom: 23,
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
    marginBottom: 7,
  },

  fieldLabel: {
    marginTop: 13,
  },

  input: {
    height: 46,
    borderWidth: 1,
    borderColor: COLORS.border,
    borderRadius: 12,
    paddingHorizontal: 14,
    color: COLORS.navy,
    backgroundColor: '#FEFEFC',
    fontSize: 14,
  },

  registerButton: {
    height: 50,
    borderRadius: 13,
    backgroundColor: COLORS.darkGreen,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 23,
  },

  registerButtonText: {
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

  loginRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    flexWrap: 'wrap',
    marginTop: 22,
  },

  loginText: {
    color: COLORS.navy,
    fontSize: 13,
    fontWeight: '500',
  },

  loginLink: {
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
