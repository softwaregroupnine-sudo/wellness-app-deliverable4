import React, { useCallback, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Alert,
  StatusBar,
  Image,
  Modal,
  Linking,
} from 'react-native';
import { Ionicons, Feather } from '@expo/vector-icons';
import AsyncStorage from '@react-native-async-storage/async-storage';
import * as Contacts from 'expo-contacts/legacy';
import { useFocusEffect } from '@react-navigation/native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { clearSession } from '../utils/session';

// Reusable row for the Settings menu.
function SettingsRow({
  icon,
  title,
  color = '#263D39',
  onPress,
  showIcon = true,
}) {
  return (
    <TouchableOpacity
      style={styles.settingsRow}
      onPress={onPress}
      activeOpacity={0.7}
      accessibilityRole="button"
      accessibilityLabel={title}
    >
      <View style={styles.iconContainer}>
        {showIcon && (
          <Ionicons name={icon} size={23} color={color} />
        )}
      </View>

      <Text style={[styles.rowTitle, { color }]}>{title}</Text>

      <Feather name="chevron-right" size={22} color="#7B8583" />
    </TouchableOpacity>
  );
}

// Reusable action row inside information sections.
function ActionRow({ icon, title, description, onPress }) {
  return (
    <TouchableOpacity
      style={styles.actionRow}
      onPress={onPress}
      activeOpacity={0.7}
      accessibilityRole="button"
    >
      <View style={styles.actionIcon}>
        <Ionicons name={icon} size={22} color="#466B58" />
      </View>

      <View style={styles.actionText}>
        <Text style={styles.actionTitle}>{title}</Text>
        <Text style={styles.actionDescription}>{description}</Text>
      </View>

      <Feather name="chevron-right" size={20} color="#7B8583" />
    </TouchableOpacity>
  );
}

// Reusable Call/Text button.
function ContactActionButton({
  label,
  icon,
  onPress,
  variant = 'call',
}) {
  const isEmergency = variant === 'emergency';
  const isText = variant === 'text';

  return (
    <TouchableOpacity
      style={[
        styles.contactActionButton,
        isEmergency && styles.emergencyCallButton,
        isText && styles.textMessageButton,
      ]}
      onPress={onPress}
      activeOpacity={0.8}
      accessibilityRole="button"
      accessibilityLabel={label}
    >
      <Ionicons
        name={icon}
        size={18}
        color={
          isEmergency
            ? '#FFFFFF'
            : isText
              ? '#466B58'
              : '#FFFFFF'
        }
      />

      <Text
        style={[
          styles.contactActionText,
          isEmergency && styles.emergencyCallText,
          isText && styles.textMessageText,
        ]}
      >
        {label}
      </Text>
    </TouchableOpacity>
  );
}

// Reusable card for campus and trusted contacts.
function ContactCard({
  icon,
  title,
  subtitle,
  number,
  onCall,
  onText,
  emergency = false,
}) {
  return (
    <View style={styles.contactCard}>
      <View style={styles.contactCardHeader}>
        <View
          style={[
            styles.contactCardIcon,
            emergency && styles.emergencyIconBackground,
          ]}
        >
          <Ionicons
            name={icon}
            size={23}
            color={emergency ? '#C93636' : '#466B58'}
          />
        </View>

        <View style={styles.contactCardDetails}>
          <Text style={styles.contactCardTitle}>{title}</Text>

          {!!subtitle && (
            <Text style={styles.contactCardSubtitle}>
              {subtitle}
            </Text>
          )}

          {!!number && (
            <Text style={styles.contactCardNumber}>{number}</Text>
          )}
        </View>
      </View>

      <View style={styles.contactActions}>
        <ContactActionButton
          label="Call"
          icon="call-outline"
          onPress={onCall}
          variant={emergency ? 'emergency' : 'call'}
        />

        {!emergency && onText && (
          <ContactActionButton
            label="Text"
            icon="chatbubble-outline"
            onPress={onText}
            variant="text"
          />
        )}
      </View>
    </View>
  );
}

export default function SettingsScreen({ navigation, route }) {
  const insets = useSafeAreaInsets();
  const user = route?.params?.user || {};

  // Existing profile-picture storage key.
  const storageKey =
    `s9_profile_${user.participant_id || user.email || 'guest'}`;

  // Separate key for the trusted contact.
  const trustedContactStorageKey =
    `s9_trusted_contact_${user.participant_id || user.email || 'guest'}`;

  const [profilePhoto, setProfilePhoto] = useState(null);
  const [trustedContact, setTrustedContact] = useState(null);
  const [selectedSection, setSelectedSection] = useState(null);

  // Refresh locally saved information when Settings becomes visible.
  useFocusEffect(
    useCallback(() => {
      let active = true;

      const loadLocalData = async () => {
        try {
          const [savedProfile, savedTrustedContact] = await Promise.all([
            AsyncStorage.getItem(storageKey),
            AsyncStorage.getItem(trustedContactStorageKey),
          ]);

          const profileData = savedProfile
            ? JSON.parse(savedProfile)
            : {};

          const trustedContactData = savedTrustedContact
            ? JSON.parse(savedTrustedContact)
            : null;

          if (active) {
            setProfilePhoto(profileData.profilePhoto || null);
            setTrustedContact(trustedContactData);
          }
        } catch (error) {
          console.error('Could not load local Settings data:', error);

          if (active) {
            setProfilePhoto(null);
            setTrustedContact(null);
          }
        }
      };

      loadLocalData();

      return () => {
        active = false;
      };
    }, [storageKey, trustedContactStorageKey])
  );

  const openSection = (section) => {
    setSelectedSection(section);
  };

  const closeSection = () => {
    setSelectedSection(null);
  };

  const openActivity = (screenName) => {
    closeSection();
    navigation.navigate(screenName, { user });
  };

  // Opens the phone dialler.
  const callEmergencyNumber = async (number, service) => {
    const phoneNumber = String(number).replace(/[^\d+]/g, '');
    const phoneUrl = `tel:${phoneNumber}`;

    try {
      const supported = await Linking.canOpenURL(phoneUrl);

      if (!supported) {
        Alert.alert(
          'Calling unavailable',
          'Your device cannot place a call from this screen.'
        );
        return;
      }

      await Linking.openURL(phoneUrl);
    } catch (error) {
      Alert.alert(
        'Unable to open phone',
        `Please call ${number} directly for ${service}.`
      );
    }
  };

  // Opens the phone's SMS application.
  const textContact = async (number, contactName) => {
    if (!number) {
      Alert.alert(
        'No phone number',
        'There is no phone number available for this contact.'
      );
      return;
    }

    const phoneNumber = String(number).replace(/[^\d+]/g, '');
    const smsUrl = `sms:${phoneNumber}`;

    try {
      const supported = await Linking.canOpenURL(smsUrl);

      if (!supported) {
        Alert.alert(
          'Messaging unavailable',
          'Your device cannot open a messaging application from this screen.'
        );
        return;
      }

      await Linking.openURL(smsUrl);
    } catch (error) {
      Alert.alert(
        'Unable to open messages',
        `Please open your messaging app and message ${contactName || 'your contact'} directly.`
      );
    }
  };

  // Lets the user select a person using the phone's contact picker.
  const chooseTrustedContact = async () => {
    try {
      const contact = await Contacts.presentContactPickerAsync();

      if (!contact) {
        return;
      }

      const phoneNumbers = contact.phoneNumbers || [];

      if (phoneNumbers.length === 0) {
        Alert.alert(
          'No phone number found',
          'Please select a contact that has a phone number saved.'
        );
        return;
      }

      const selectedPhone = phoneNumbers[0].number;

      if (!selectedPhone) {
        Alert.alert(
          'No phone number found',
          'Please select a contact that has a valid phone number.'
        );
        return;
      }

      const selectedContact = {
        name: contact.name || 'Trusted person',
        phoneNumber: selectedPhone,
      };

      await AsyncStorage.setItem(
        trustedContactStorageKey,
        JSON.stringify(selectedContact)
      );

      setTrustedContact(selectedContact);

      Alert.alert(
        'Trusted person saved',
        `${selectedContact.name} has been saved on this device.`
      );
    } catch (error) {
      console.error('Could not select trusted contact:', error);

      Alert.alert(
        'Unable to select contact',
        'Please try again. If the problem continues, check that expo-contacts is installed and your Expo app has been restarted.'
      );
    }
  };

  // Removes only the locally saved trusted contact.
  const removeTrustedContact = () => {
    Alert.alert(
      'Remove trusted person',
      'Are you sure you want to remove this trusted person from this device?',
      [
        {
          text: 'Cancel',
          style: 'cancel',
        },
        {
          text: 'Remove',
          style: 'destructive',
          onPress: async () => {
            try {
              await AsyncStorage.removeItem(trustedContactStorageKey);
              setTrustedContact(null);
            } catch (error) {
              Alert.alert(
                'Unable to remove contact',
                'Please try again.'
              );
            }
          },
        },
      ]
    );
  };

  // Clears profile-picture data only.
  const clearProfileData = () => {
    Alert.alert(
      'Clear profile picture data',
      'This removes your saved profile picture and recent picture selections from this device. It does not delete your registered account or trusted person.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Clear data',
          style: 'destructive',
          onPress: async () => {
            try {
              await AsyncStorage.removeItem(storageKey);
              setProfilePhoto(null);
              closeSection();

              Alert.alert(
                'Data cleared',
                'Your locally saved profile-picture data has been removed.'
              );
            } catch (error) {
              Alert.alert(
                'Unable to clear data',
                'Please try again.'
              );
            }
          },
        },
      ]
    );
  };

  const handleLogout = () => {
    Alert.alert(
      'Log Out',
      'Are you sure you want to log out?',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Log Out',
          style: 'destructive',
          onPress: async () => {
            // Forget the saved login before returning to the login screen.
            await clearSession();
            navigation.replace('Login');
          },
        },
      ]
    );
  };

  // Open a Spotify playlist outside the app.
  const openSpotifyPlaylist = async (url) => {
    try {
      await Linking.openURL(url);
    } catch (error) {
      Alert.alert(
        'Unable to open playlist',
        'Please check your internet connection and try again.'
      );
    }
  };

  const renderSectionContent = () => {
    switch (selectedSection) {
      case 'Privacy & Data':
        return (
          <>
            <Text style={styles.modalDescription}>
              Understand what is saved locally and manage your
              profile-picture and trusted-contact data.
            </Text>

            <View style={styles.informationCard}>
              <Ionicons
                name="phone-portrait-outline"
                size={22}
                color="#466B58"
              />
              <View style={styles.informationText}>
                <Text style={styles.informationTitle}>
                  Profile pictures
                </Text>
                <Text style={styles.informationDescription}>
                  Your selected profile picture and recent picture
                  selections are saved on this device using
                  local storage.
                </Text>
              </View>
            </View>

            <View style={styles.informationCard}>
              <Ionicons
                name="person-circle-outline"
                size={22}
                color="#466B58"
              />
              <View style={styles.informationText}>
                <Text style={styles.informationTitle}>
                  Trusted contact
                </Text>
                <Text style={styles.informationDescription}>
                  Your selected trusted person's name and phone
                  number are saved locally on this device. They
                  are not saved to the app's database.
                </Text>
              </View>
            </View>

            <View style={styles.informationCard}>
              <Ionicons
                name="person-circle-outline"
                size={22}
                color="#466B58"
              />
              <View style={styles.informationText}>
                <Text style={styles.informationTitle}>
                  Account information
                </Text>
                <Text style={styles.informationDescription}>
                  Your displayed name and email come from your
                  registered account. Clearing profile-picture
                  data does not delete your account or trusted
                  contact.
                </Text>
              </View>
            </View>

            <TouchableOpacity
              style={styles.dangerButton}
              onPress={clearProfileData}
              activeOpacity={0.8}
            >
              <Ionicons
                name="trash-outline"
                size={19}
                color="#FFFFFF"
              />
              <Text style={styles.dangerButtonText}>
                Clear profile picture data
              </Text>
            </TouchableOpacity>
          </>
        );

      case 'Wellness Library':
        return (
          <>
            <Text style={styles.modalDescription}>
              Small activities can help you make space for
              your wellbeing throughout the day.
            </Text>

            <View style={styles.tipCard}>
              <Text style={styles.tipTitle}>Pause and breathe</Text>
              <Text style={styles.tipDescription}>
                Take a short break, relax your shoulders and
                breathe slowly at a comfortable pace.
              </Text>
            </View>

            <View style={styles.tipCard}>
              <Text style={styles.tipTitle}>Notice the present</Text>
              <Text style={styles.tipDescription}>
                Name a few things you can see, hear and feel
                around you to bring your attention back to
                the present moment.
              </Text>
            </View>

            <View style={styles.tipCard}>
              <Text style={styles.tipTitle}>Reflect on your day</Text>
              <Text style={styles.tipDescription}>
                Write down one thing you appreciated today
                or one small step you took for yourself.
              </Text>
            </View>

            <ActionRow
              icon="leaf-outline"
              title="Breathing Exercise"
              description="Try a guided breathing activity"
              onPress={() => openActivity('BreathingExercise')}
            />

            <ActionRow
              icon="book-outline"
              title="Gratitude Journal"
              description="Reflect on something positive"
              onPress={() => openActivity('GratitudeJournal')}
            />

            <ActionRow
              icon="walk-outline"
              title="Move Your Body"
              description="Short, gentle movement routines"
              onPress={() => openActivity('MoveBody')}
            />
          </>
        );

      case 'Study Toolkit':
        return (
          <>
            <Text style={styles.modalDescription}>
              Use these activities to structure study sessions
              and listen to focus music.
            </Text>

            <ActionRow
              icon="timer-outline"
              title="Focus Timer"
              description="Set aside time for one study task"
              onPress={() => openActivity('FocusTimer')}
            />

            <ActionRow
              icon="leaf-outline"
              title="Breathing Exercise"
              description="Take a short mindful break"
              onPress={() => openActivity('BreathingExercise')}
            />

            <View style={styles.tipCard}>
              <Text style={styles.tipTitle}>A simple study plan</Text>
              <Text style={styles.tipDescription}>
                Choose one task, break it into smaller steps,
                remove distractions and take a short break
                when you need one.
              </Text>
            </View>

            <View style={styles.toolkitSection}>
              <Text style={styles.toolkitSectionHeading}>
                Study Music
              </Text>
              <Text style={styles.toolkitSectionDescription}>
                Choose a playlist to open it in Spotify.
              </Text>

              <ActionRow
                icon="musical-notes-outline"
                title="Wellness Deep Focus"
                description="Deep focus music for study sessions"
                onPress={() =>
                  openSpotifyPlaylist(
                    'https://open.spotify.com/playlist/0G40kpo0O7mhOitJzNLlEU?si=dea1aecbf185490c&pt=eb6a4fa7f12370c6dd16ab392c97d0c3'
                  )
                }
              />

              <ActionRow
                icon="headset-outline"
                title="Wellness House Focus"
                description="House music to keep your study flow going"
                onPress={() =>
                  openSpotifyPlaylist(
                    'https://open.spotify.com/playlist/42lkpZJhKbnI3uKOyynAD7?si=07b2ec5dd8374021&pt=7d03a22b0dd82a82d06992bcf0f4bf79'
                  )
                }
              />

              <ActionRow
                icon="radio-outline"
                title="Wellness Jazz Focus"
                description="Jazz music for a relaxed study atmosphere"
                onPress={() =>
                  openSpotifyPlaylist(
                    'https://open.spotify.com/playlist/3SYINwtdpP7jo2Y36xwahT?si=750c927c1b53464b&pt=1b15df6ca1e27a75dd16566d0140391d'
                  )
                }
              />
            </View>
          </>
        );

      case 'Emergency Contacts':
        return (
          <>
            <Text style={styles.modalDescription}>
              Keep important support contacts close by. You can
              call a service or open your messaging app to text
              a contact. If you are in immediate danger, call
              emergency services.
            </Text>

            <Text style={styles.contactSectionHeading}>
              Your trusted person
            </Text>

            {trustedContact ? (
              <ContactCard
                icon="person-circle-outline"
                title={trustedContact.name}
                subtitle="Your chosen trusted person"
                number={trustedContact.phoneNumber}
                onCall={() =>
                  callEmergencyNumber(
                    trustedContact.phoneNumber,
                    'your trusted person'
                  )
                }
                onText={() =>
                  textContact(
                    trustedContact.phoneNumber,
                    trustedContact.name
                  )
                }
              />
            ) : (
              <View style={styles.trustedContactPrompt}>
                <View style={styles.contactCardHeader}>
                  <View style={styles.contactCardIcon}>
                    <Ionicons
                      name="person-add-outline"
                      size={23}
                      color="#466B58"
                    />
                  </View>

                  <View style={styles.contactCardDetails}>
                    <Text style={styles.contactCardTitle}>
                      Add a trusted person
                    </Text>
                    <Text style={styles.contactCardSubtitle}>
                      Choose a friend, family member or someone
                      you trust from your phone contacts.
                    </Text>
                  </View>
                </View>

                <TouchableOpacity
                  style={styles.selectContactButton}
                  onPress={chooseTrustedContact}
                  activeOpacity={0.8}
                >
                  <Ionicons
                    name="people-outline"
                    size={19}
                    color="#FFFFFF"
                  />
                  <Text style={styles.selectContactButtonText}>
                    Select from contacts
                  </Text>
                </TouchableOpacity>
              </View>
            )}

            {trustedContact && (
              <>
                <TouchableOpacity
                  style={styles.changeContactButton}
                  onPress={chooseTrustedContact}
                  activeOpacity={0.7}
                >
                  <Ionicons
                    name="person-add-outline"
                    size={17}
                    color="#466B58"
                  />
                  <Text style={styles.changeContactText}>
                    Choose a different person
                  </Text>
                </TouchableOpacity>

                <TouchableOpacity
                  style={styles.removeContactButton}
                  onPress={removeTrustedContact}
                  activeOpacity={0.7}
                >
                  <Text style={styles.removeContactText}>
                    Remove trusted person
                  </Text>
                </TouchableOpacity>
              </>
            )}

            <Text style={styles.contactSectionHeading}>
              Campus support
            </Text>

            <ContactCard
              icon="leaf-outline"
              title="Campus Wellbeing Team"
              subtitle="Wellbeing support"
              number="+27826023256"
              onCall={() =>
                callEmergencyNumber(
                  '+27826023256',
                  'the Campus Wellbeing Team'
                )
              }
              onText={() =>
                textContact(
                  '+27826023256',
                  'the Campus Wellbeing Team'
                )
              }
            />

            <ContactCard
              icon="school-outline"
              title="Student Support Services"
              subtitle="Student support"
              number="+27 93 202 6321"
              onCall={() =>
                callEmergencyNumber(
                  '+27932026321',
                  'Student Support Services'
                )
              }
              onText={() =>
                textContact(
                  '+27932026321',
                  'Student Support Services'
                )
              }
            />

            <Text style={styles.contactSectionHeading}>
              Emergency services
            </Text>

            <Text style={styles.emergencyDescription}>
              For immediate assistance in South Africa, use
              the emergency call button below.
            </Text>

            <ContactCard
              icon="alert-circle-outline"
              title="Emergency assistance"
              subtitle="South Africa · Mobile emergency number"
              number="112"
              emergency
              onCall={() =>
                callEmergencyNumber('112', 'emergency assistance')
              }
            />

            <ContactCard
              icon="shield-outline"
              title="South African Police Service"
              subtitle="Police emergency line"
              number="10111"
              onCall={() =>
                callEmergencyNumber('10111', 'police assistance')
              }
            />

            <ContactCard
              icon="medkit-outline"
              title="Ambulance emergency"
              subtitle="Ambulance service"
              number="10177"
              onCall={() =>
                callEmergencyNumber('10177', 'ambulance assistance')
              }
            />

            <Text style={styles.safetyNote}>
              If possible, tell the operator your location and
              briefly explain what has happened. Emergency
              numbers are intended for urgent assistance.
            </Text>
          </>
        );

      case 'Help & Support':
        return (
          <>
            <Text style={styles.modalDescription}>
              Here is how to use the main features of your
              Wellness Support App.
            </Text>

            <View style={styles.tipCard}>
              <Text style={styles.tipTitle}>Mood Check-In</Text>
              <Text style={styles.tipDescription}>
                Record how you feel and add a note about
                your day.
              </Text>
            </View>

            <View style={styles.tipCard}>
              <Text style={styles.tipTitle}>Written Assessment</Text>
              <Text style={styles.tipDescription}>
                Describe how you feel in your own words from the
                Dashboard. You can edit or delete your entries.
              </Text>
            </View>

            <View style={styles.tipCard}>
              <Text style={styles.tipTitle}>AI Analysis</Text>
              <Text style={styles.tipDescription}>
                Review the patterns and suggestions generated from
                your check-ins and written assessments.
              </Text>
            </View>

            <View style={styles.tipCard}>
              <Text style={styles.tipTitle}>Personalised Guidance</Text>
              <Text style={styles.tipDescription}>
                Explore suggested activities that may help
                you manage your day.
              </Text>
            </View>

            <ActionRow
              icon="chatbubble-ellipses-outline"
              title="Open AI Chat"
              description="Ask a general student-wellness question"
              onPress={() => openActivity('AIChat')}
            />

            <Text style={styles.safetyNote}>
              AI Chat provides general wellness support. It
              is not a crisis service or a substitute for
              professional care.
            </Text>
          </>
        );

      default:
        return null;
    }
  };

  const sectionIcon = {
    'Privacy & Data': 'shield-checkmark-outline',
    'Wellness Library': 'book-outline',
    'Study Toolkit': 'school-outline',
    'Emergency Contacts': 'people-outline',
    'Help & Support': 'help-circle-outline',
  };

  return (
    <View style={styles.container}>
      <StatusBar barStyle="dark-content" backgroundColor="#F4EFE8" />

      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={[
          styles.scrollContent,
          { paddingTop: insets.top + 12 },
        ]}
      >
        {/* Decorative background leaf */}
        <Text
          pointerEvents="none"
          style={[
            styles.backgroundLeaf,
            { top: insets.top + 100 },
          ]}
          accessibilityElementsHidden
          importantForAccessibility="no"
        >
          🍃
        </Text>

        <View style={styles.header}>
          <Ionicons name="leaf" size={27} color="#466B58" />
          <Text style={styles.headerTitle}>Settings</Text>
        </View>

        <TouchableOpacity
          style={styles.profileCard}
          onPress={() => navigation.navigate('Profile', { user })}
          activeOpacity={0.8}
          accessibilityRole="button"
          accessibilityLabel="View profile"
        >
          <View style={styles.avatar}>
            {profilePhoto ? (
              <Image
                source={{ uri: profilePhoto }}
                style={styles.avatarImage}
              />
            ) : (
              <Ionicons name="person" size={34} color="#76678B" />
            )}
          </View>

          <View style={styles.profileDetails}>
            <Text style={styles.profileName}>
              {user.display_name || 'Student'}
            </Text>

            <Text style={styles.profileMore} numberOfLines={1}>
              {user.email || 'Account details'}
            </Text>
          </View>

          <View style={styles.viewProfile}>
            <Text style={styles.viewProfileText}>View profile</Text>
            <Feather
              name="chevron-right"
              size={20}
              color="#7B8583"
            />
          </View>
        </TouchableOpacity>

        <Text style={styles.tagline}>Mindful every day</Text>

        <View style={styles.settingsCard}>
          <SettingsRow
            icon="notifications-outline"
            title="Notifications"
            color="#79688F"
            onPress={() => navigation.navigate('Notifications', { user })}
          />

          <View style={styles.divider} />

          <SettingsRow
            icon="shield-checkmark-outline"
            title="Privacy & Data"
            color="#79688F"
            onPress={() => openSection('Privacy & Data')}
          />
        </View>

        <View style={styles.settingsCard}>
          <SettingsRow
            icon="book-outline"
            title="Wellness Library"
            color="#668369"
            onPress={() => openSection('Wellness Library')}
          />

          <View style={styles.divider} />

          <SettingsRow
            icon="school-outline"
            title="Study Toolkit"
            color="#79688F"
            onPress={() => openSection('Study Toolkit')}
          />
        </View>

        <View style={styles.settingsCard}>
          <SettingsRow
            icon="people-outline"
            title="Emergency Contacts"
            color="#668369"
            onPress={() => openSection('Emergency Contacts')}
          />

          <View style={styles.divider} />

          <SettingsRow
            title="Help & Support"
            showIcon={false}
            onPress={() => openSection('Help & Support')}
          />

          <TouchableOpacity
            style={styles.logoutRow}
            onPress={handleLogout}
            activeOpacity={0.7}
          >
            <Text style={styles.logoutText}>Log Out</Text>
          </TouchableOpacity>
        </View>
      </ScrollView>

      <Modal
        visible={selectedSection !== null}
        transparent
        animationType="slide"
        onRequestClose={closeSection}
      >
        <View style={styles.modalOverlay}>
          <View
            style={[
              styles.modalContainer,
              { paddingBottom: Math.max(insets.bottom, 24) },
            ]}
          >
            <View style={styles.modalHeader}>
              <View style={styles.modalHeading}>
                {selectedSection && (
                  <Ionicons
                    name={sectionIcon[selectedSection]}
                    size={24}
                    color="#466B58"
                  />
                )}

                <Text style={styles.modalTitle}>
                  {selectedSection}
                </Text>
              </View>

              <TouchableOpacity
                onPress={closeSection}
                style={styles.closeButton}
                accessibilityRole="button"
                accessibilityLabel="Close"
              >
                <Feather name="x" size={22} color="#263D39" />
              </TouchableOpacity>
            </View>

            <ScrollView
              showsVerticalScrollIndicator={false}
              contentContainerStyle={styles.modalContent}
              keyboardShouldPersistTaps="handled"
            >
              {renderSectionContent()}
            </ScrollView>
          </View>
        </View>
      </Modal>
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
    paddingBottom: 110,
  },

  backgroundLeaf: {
    position: 'absolute',
    right: -12,
    fontSize: 100,
    opacity: 0.09,
    transform: [{ rotate: '-25deg' }],
    zIndex: 0,
  },

  header: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    marginBottom: 24,
    marginLeft: 4,
    zIndex: 1,
  },

  headerTitle: {
    fontSize: 24,
    fontWeight: '700',
    color: '#3F4B49',
  },

  profileCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 20,
    padding: 16,
    minHeight: 112,
    flexDirection: 'row',
    alignItems: 'center',
    zIndex: 1,
  },

  avatar: {
    width: 58,
    height: 58,
    borderRadius: 29,
    backgroundColor: '#E7DFEF',
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
  },

  avatarImage: {
    width: 58,
    height: 58,
    borderRadius: 29,
  },

  profileDetails: {
    flex: 1,
    minWidth: 0,
    marginLeft: 14,
  },

  profileName: {
    fontSize: 17,
    fontWeight: '700',
    color: '#263D39',
  },

  profileMore: {
    fontSize: 12,
    fontWeight: '500',
    color: '#7B8583',
    marginTop: 8,
  },

  viewProfile: {
    flexDirection: 'row',
    alignItems: 'center',
    marginLeft: 4,
  },

  viewProfileText: {
    color: '#7B8583',
    fontSize: 12,
  },

  tagline: {
    color: '#7B8583',
    fontSize: 13,
    marginTop: 12,
    marginBottom: 20,
  },

  settingsCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 18,
    paddingHorizontal: 14,
    marginBottom: 18,
    overflow: 'hidden',
    zIndex: 1,
  },

  settingsRow: {
    minHeight: 59,
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 10,
  },

  iconContainer: {
    width: 42,
    alignItems: 'flex-start',
    justifyContent: 'center',
  },

  rowTitle: {
    flex: 1,
    fontSize: 15,
    fontWeight: '600',
    marginLeft: 8,
  },

  divider: {
    height: 1,
    backgroundColor: '#E8E5E1',
  },

  logoutRow: {
    minHeight: 44,
    justifyContent: 'center',
    paddingLeft: 50,
  },

  logoutText: {
    color: '#D14D48',
    fontSize: 15,
    fontWeight: '600',
    textDecorationLine: 'underline',
  },

  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(24, 37, 33, 0.45)',
    justifyContent: 'flex-end',
  },

  modalContainer: {
    backgroundColor: '#F4EFE8',
    borderTopLeftRadius: 26,
    borderTopRightRadius: 26,
    maxHeight: '88%',
    paddingTop: 20,
    paddingHorizontal: 20,
  },

  modalHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 14,
  },

  modalHeading: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    marginRight: 10,
  },

  modalTitle: {
    flex: 1,
    fontSize: 21,
    fontWeight: '700',
    color: '#263D39',
  },

  closeButton: {
    width: 38,
    height: 38,
    borderRadius: 19,
    backgroundColor: '#FFFFFF',
    alignItems: 'center',
    justifyContent: 'center',
  },

  modalContent: {
    paddingBottom: 12,
  },

  modalDescription: {
    color: '#64716A',
    fontSize: 14,
    lineHeight: 21,
    marginBottom: 18,
  },

  informationCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 15,
    padding: 15,
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 12,
    marginBottom: 12,
  },

  informationText: {
    flex: 1,
  },

  informationTitle: {
    fontSize: 15,
    fontWeight: '700',
    color: '#263D39',
    marginBottom: 5,
  },

  informationDescription: {
    color: '#64716A',
    fontSize: 13,
    lineHeight: 19,
  },

  actionRow: {
    backgroundColor: '#FFFFFF',
    borderRadius: 15,
    padding: 13,
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 10,
    gap: 12,
  },

  actionIcon: {
    width: 42,
    height: 42,
    borderRadius: 13,
    backgroundColor: '#EAF0E9',
    alignItems: 'center',
    justifyContent: 'center',
  },

  actionText: {
    flex: 1,
  },

  actionTitle: {
    color: '#263D39',
    fontSize: 14,
    fontWeight: '700',
  },

  actionDescription: {
    color: '#7B8583',
    fontSize: 12,
    lineHeight: 18,
    marginTop: 4,
  },

  tipCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 15,
    padding: 15,
    marginBottom: 12,
  },

  tipTitle: {
    color: '#263D39',
    fontSize: 15,
    fontWeight: '700',
    marginBottom: 6,
  },

  tipDescription: {
    color: '#64716A',
    fontSize: 13,
    lineHeight: 20,
  },

  // Study Toolkit styles.
  toolkitSection: {
    marginTop: 12,
    marginBottom: 8,
  },

  toolkitSectionHeading: {
    color: '#263D39',
    fontSize: 17,
    fontWeight: '700',
    marginBottom: 6,
  },

  toolkitSectionDescription: {
    color: '#64716A',
    fontSize: 13,
    lineHeight: 19,
    marginBottom: 12,
  },

  // Emergency Contacts section.
  contactSectionHeading: {
    fontSize: 16,
    fontWeight: '700',
    color: '#263D39',
    marginTop: 10,
    marginBottom: 12,
  },

  emergencyDescription: {
    fontSize: 13,
    color: '#64716A',
    lineHeight: 19,
    marginBottom: 12,
  },

  contactCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    padding: 15,
    marginBottom: 12,
  },

  contactCardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },

  contactCardIcon: {
    width: 46,
    height: 46,
    borderRadius: 14,
    backgroundColor: '#EAF0E9',
    alignItems: 'center',
    justifyContent: 'center',
  },

  emergencyIconBackground: {
    backgroundColor: '#FCE8E7',
  },

  contactCardDetails: {
    flex: 1,
    minWidth: 0,
  },

  contactCardTitle: {
    fontSize: 15,
    fontWeight: '700',
    color: '#263D39',
  },

  contactCardSubtitle: {
    fontSize: 12,
    color: '#7B8583',
    lineHeight: 18,
    marginTop: 4,
  },

  contactCardNumber: {
    fontSize: 14,
    fontWeight: '600',
    color: '#466B58',
    marginTop: 5,
  },

  contactActions: {
    flexDirection: 'column',
    gap: 9,
    marginTop: 14,
  },

  contactActionButton: {
    minHeight: 45,
    borderRadius: 12,
    backgroundColor: '#466B58',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 9,
    paddingHorizontal: 14,
  },

  contactActionText: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: '700',
  },

  textMessageButton: {
    backgroundColor: '#EAF0E9',
    borderWidth: 1,
    borderColor: '#D3E0D3',
  },

  textMessageText: {
    color: '#466B58',
  },

  emergencyCallButton: {
    backgroundColor: '#C93636',
    borderWidth: 1,
    borderColor: '#B62B2B',
    minHeight: 52,
  },

  emergencyCallText: {
    color: '#FFFFFF',
    fontSize: 15,
  },

  trustedContactPrompt: {
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    padding: 15,
    marginBottom: 12,
  },

  selectContactButton: {
    minHeight: 47,
    backgroundColor: '#466B58',
    borderRadius: 12,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 9,
    marginTop: 15,
    paddingHorizontal: 12,
  },

  selectContactButtonText: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: '700',
  },

  changeContactButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 7,
    paddingVertical: 11,
  },

  changeContactText: {
    color: '#466B58',
    fontSize: 13,
    fontWeight: '600',
  },

  removeContactButton: {
    alignItems: 'center',
    paddingVertical: 9,
    marginBottom: 8,
  },

  removeContactText: {
    color: '#C14F4B',
    fontSize: 13,
    fontWeight: '600',
  },

  safetyNote: {
    color: '#64716A',
    fontSize: 12,
    lineHeight: 19,
    marginTop: 8,
    marginBottom: 12,
  },

  dangerButton: {
    backgroundColor: '#C14F4B',
    borderRadius: 14,
    minHeight: 48,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 9,
    marginTop: 8,
    paddingHorizontal: 12,
  },

  dangerButtonText: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: '700',
  },
});