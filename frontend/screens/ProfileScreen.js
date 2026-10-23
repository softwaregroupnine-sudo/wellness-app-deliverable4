
import React, { useEffect, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  StatusBar,
  Image,
  Alert,
} from 'react-native';
import { Ionicons, Feather } from '@expo/vector-icons';
import * as ImagePicker from 'expo-image-picker';
import AsyncStorage from '@react-native-async-storage/async-storage';

export default function ProfileScreen({ navigation, route }) {
  const user = route?.params?.user || {};

  const displayName = user.display_name || 'Student';
  const email = user.email || 'No email available';

  // The account identifier is used internally, not displayed.
  const storageKey =
    `s9_profile_${user.participant_id || user.email || 'guest'}`;

  const [profilePhoto, setProfilePhoto] = useState(null);
  const [recentPhotos, setRecentPhotos] = useState([]);

  useEffect(() => {
    const loadPhotos = async () => {
      try {
        const saved = await AsyncStorage.getItem(storageKey);

        if (saved) {
          const data = JSON.parse(saved);
          setProfilePhoto(data.profilePhoto || null);
          setRecentPhotos(data.recentPhotos || []);
        }
      } catch (error) {
        console.error('Could not load profile photos:', error);
      }
    };

    loadPhotos();
  }, [storageKey]);

  const savePhotos = async (photo, recent) => {
    try {
      await AsyncStorage.setItem(
        storageKey,
        JSON.stringify({
          profilePhoto: photo,
          recentPhotos: recent,
        })
      );
    } catch (error) {
      Alert.alert(
        'Unable to save',
        'Your photo could not be saved on this device.'
      );
    }
  };

  const choosePhoto = async () => {
    try {
      const permission =
        await ImagePicker.requestMediaLibraryPermissionsAsync();

      if (!permission.granted) {
        Alert.alert(
          'Photo access needed',
          'Allow photo library access in your device settings to choose a profile picture.'
        );
        return;
      }

      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ['images'],
        allowsEditing: true,
        aspect: [1, 1],
        quality: 0.8,
      });

      if (result.canceled || !result.assets?.length) {
        return;
      }

      await applyPhoto(result.assets[0].uri);
    } catch (error) {
      Alert.alert(
        'Something went wrong',
        'We could not open your photo library. Please try again.'
      );
    }
  };

  const applyPhoto = async (uri) => {
    const updatedRecent = [
      uri,
      ...recentPhotos.filter((photo) => photo !== uri),
    ].slice(0, 5);

    setProfilePhoto(uri);
    setRecentPhotos(updatedRecent);

    await savePhotos(uri, updatedRecent);
  };

  const removePhoto = () => {
    Alert.alert(
      'Remove profile picture',
      'Would you like to return to your default profile picture?',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Remove',
          style: 'destructive',
          onPress: async () => {
            setProfilePhoto(null);
            await savePhotos(null, recentPhotos);
          },
        },
      ]
    );
  };

  const initials = displayName
    .trim()
    .split(/\s+/)
    .slice(0, 2)
    .map((part) => part.charAt(0).toUpperCase())
    .join('');

  return (
    <View style={styles.container}>
      <StatusBar barStyle="dark-content" backgroundColor="#F4EFE8" />

      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={styles.scrollContent}
      >
        <View style={styles.header}>
          <TouchableOpacity
            onPress={() => navigation.goBack()}
            style={styles.backButton}
            activeOpacity={0.7}
          >
            <Feather name="arrow-left" size={22} color="#263D39" />
          </TouchableOpacity>

          <Text style={styles.headerTitle}>My Profile</Text>
        </View>

        {/* Profile picture and account details */}
        <View style={styles.profileCard}>
          <TouchableOpacity
            onPress={choosePhoto}
            activeOpacity={0.8}
            accessibilityLabel="Change profile picture"
          >
            <View style={styles.avatar}>
              {profilePhoto ? (
                <Image
                  source={{ uri: profilePhoto }}
                  style={styles.avatarImage}
                />
              ) : (
                <Text style={styles.initials}>{initials || 'S'}</Text>
              )}

              <View style={styles.cameraButton}>
                <Ionicons name="camera" size={17} color="#FFFFFF" />
              </View>
            </View>
          </TouchableOpacity>

          <Text style={styles.changePhotoText}>
            Tap your picture to change it
          </Text>

          {profilePhoto ? (
            <TouchableOpacity onPress={removePhoto}>
              <Text style={styles.removePhotoText}>
                Remove picture
              </Text>
            </TouchableOpacity>
          ) : null}

          <Text style={styles.profileName}>{displayName}</Text>
          <Text style={styles.profileEmail}>{email}</Text>

          <View style={styles.accountBadge}>
            <Ionicons
              name="person-circle-outline"
              size={16}
              color="#466B58"
            />
            <Text style={styles.accountBadgeText}>My account</Text>
          </View>
        </View>

        {/* Recently selected profile pictures */}
        {recentPhotos.length > 0 ? (
          <View style={styles.recentSection}>
            <View style={styles.sectionHeading}>
              <Text style={styles.sectionTitle}>
                Recent Profile Pictures
              </Text>
              <Text style={styles.recentCount}>
                {recentPhotos.length}/5
              </Text>
            </View>

            <Text style={styles.sectionDescription}>
              Tap a picture to use it again.
            </Text>

            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              contentContainerStyle={styles.recentList}
            >
              {recentPhotos.map((uri, index) => (
                <TouchableOpacity
                  key={`${uri}-${index}`}
                  onPress={() => applyPhoto(uri)}
                  style={[
                    styles.recentPhotoButton,
                    profilePhoto === uri && styles.selectedPhoto,
                  ]}
                  activeOpacity={0.75}
                >
                  <Image
                    source={{ uri }}
                    style={styles.recentPhoto}
                  />
                  {profilePhoto === uri ? (
                    <View style={styles.selectedCheck}>
                      <Ionicons
                        name="checkmark"
                        size={14}
                        color="#FFFFFF"
                      />
                    </View>
                  ) : null}
                </TouchableOpacity>
              ))}
            </ScrollView>
          </View>
        ) : null}

        {/* Account information */}
        <Text style={styles.sectionTitle}>Account Information</Text>

        <View style={styles.infoCard}>
          <View style={styles.infoRow}>
            <View style={styles.infoIcon}>
              <Ionicons
                name="person-outline"
                size={21}
                color="#79688F"
              />
            </View>

            <View style={styles.infoContent}>
              <Text style={styles.infoLabel}>Display Name</Text>
              <Text style={styles.infoValue}>{displayName}</Text>
            </View>
          </View>

          <View style={styles.divider} />

          <View style={styles.infoRow}>
            <View style={styles.infoIcon}>
              <Ionicons
                name="mail-outline"
                size={21}
                color="#79688F"
              />
            </View>

            <View style={styles.infoContent}>
              <Text style={styles.infoLabel}>Email Address</Text>
              <Text style={styles.infoValue}>{email}</Text>
            </View>
          </View>
        </View>

        <View style={styles.noteCard}>
          <Ionicons
            name="information-circle-outline"
            size={21}
            color="#466B58"
          />
          <Text style={styles.noteText}>
            Your account details come from your registered account.
            Your profile picture and recent selections are saved
            on this device.
          </Text>
        </View>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F4EFE8',
  },
  scrollContent: {
    paddingHorizontal: '4%',
    paddingTop: 48,
    paddingBottom: 40,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 24,
  },
  backButton: {
    width: 42,
    height: 42,
    borderRadius: 14,
    backgroundColor: '#FFFFFF',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12,
  },
  headerTitle: {
    fontSize: 25,
    fontWeight: '700',
    color: '#263D39',
  },
  profileCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 20,
    alignItems: 'center',
    padding: 24,
    marginBottom: 26,
  },
  avatar: {
    width: 100,
    height: 100,
    borderRadius: 50,
    backgroundColor: '#E7DFEF',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 8,
  },
  avatarImage: {
    width: 100,
    height: 100,
    borderRadius: 50,
  },
  initials: {
    fontSize: 30,
    fontWeight: '700',
    color: '#76678B',
  },
  cameraButton: {
    position: 'absolute',
    right: 0,
    bottom: 0,
    width: 33,
    height: 33,
    borderRadius: 17,
    backgroundColor: '#466B58',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 3,
    borderColor: '#FFFFFF',
  },
  changePhotoText: {
    fontSize: 12,
    color: '#7B8583',
    marginTop: 5,
  },
  removePhotoText: {
    fontSize: 12,
    color: '#C14F4B',
    marginTop: 9,
    textDecorationLine: 'underline',
  },
  profileName: {
    fontSize: 21,
    fontWeight: '700',
    color: '#263D39',
    textAlign: 'center',
    marginTop: 16,
  },
  profileEmail: {
    fontSize: 14,
    color: '#7B8583',
    marginTop: 6,
    textAlign: 'center',
  },
  accountBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#EAF0E9',
    borderRadius: 20,
    paddingHorizontal: 12,
    paddingVertical: 7,
    marginTop: 16,
    gap: 6,
  },
  accountBadgeText: {
    color: '#466B58',
    fontSize: 12,
    fontWeight: '600',
  },
  recentSection: {
    marginBottom: 26,
  },
  sectionHeading: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  sectionTitle: {
    fontSize: 17,
    fontWeight: '700',
    color: '#263D39',
    marginBottom: 12,
    marginLeft: 4,
  },
  recentCount: {
    color: '#7B8583',
    fontSize: 12,
    marginBottom: 12,
  },
  sectionDescription: {
    color: '#7B8583',
    fontSize: 13,
    marginLeft: 4,
    marginBottom: 12,
  },
  recentList: {
    gap: 12,
    paddingVertical: 3,
    paddingHorizontal: 2,
  },
  recentPhotoButton: {
    padding: 3,
    borderRadius: 40,
    borderWidth: 2,
    borderColor: 'transparent',
  },
  selectedPhoto: {
    borderColor: '#466B58',
  },
  recentPhoto: {
    width: 62,
    height: 62,
    borderRadius: 31,
  },
  selectedCheck: {
    position: 'absolute',
    right: 0,
    bottom: 0,
    width: 21,
    height: 21,
    borderRadius: 11,
    backgroundColor: '#466B58',
    alignItems: 'center',
    justifyContent: 'center',
  },
  infoCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 18,
    paddingHorizontal: 16,
    marginBottom: 18,
  },
  infoRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 17,
  },
  infoIcon: {
    width: 42,
    height: 42,
    borderRadius: 13,
    backgroundColor: '#F4EFE8',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12,
  },
  infoContent: {
    flex: 1,
  },
  infoLabel: {
    color: '#7B8583',
    fontSize: 12,
    marginBottom: 5,
  },
  infoValue: {
    color: '#263D39',
    fontSize: 15,
    fontWeight: '600',
  },
  divider: {
    height: 1,
    backgroundColor: '#E8E5E1',
  },
  noteCard: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    backgroundColor: '#EAE8DF',
    borderRadius: 16,
    padding: 15,
    gap: 10,
  },
  noteText: {
    flex: 1,
    color: '#53615A',
    fontSize: 13,
    lineHeight: 20,
  },
});
