import React, { useEffect, useRef, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Switch,
  StatusBar,
  Alert,
  Platform,
  ActivityIndicator,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import AsyncStorage from '@react-native-async-storage/async-storage';
import DateTimePicker from '@react-native-community/datetimepicker';
import * as Notifications from 'expo-notifications';

// Show notifications when the app is open.
Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldPlaySound: true,
    shouldSetBadge: false,
    shouldShowBanner: true,
    shouldShowList: true,
  }),
});

const DEFAULT_SETTINGS = {
  moodReminders: true,
  wellnessReminders: true,
  studyReminders: false,
  bedTimeReminder: false,
  reminderTime: '19:00',
};

// Convert HH:mm into a Date for the time picker.
function createTimeDate(time) {
  const [hour, minute] = (time || '19:00').split(':').map(Number);

  const validTime =
    Number.isInteger(hour) &&
    hour >= 0 &&
    hour <= 23 &&
    Number.isInteger(minute) &&
    minute >= 0 &&
    minute <= 59;

  return new Date(
    2000,
    0,
    1,
    validTime ? hour : 19,
    validTime ? minute : 0
  );
}

// Display time in the device's local format.
function formatTime(time) {
  return createTimeDate(time).toLocaleTimeString([], {
    hour: 'numeric',
    minute: '2-digit',
  });
}

// Validate the sleep schedule saved by SleepBetterScreen.
function isValidSleepSchedule(schedule) {
  return (
    schedule &&
    Number.isInteger(schedule.bedHours) &&
    schedule.bedHours >= 0 &&
    schedule.bedHours <= 23 &&
    Number.isInteger(schedule.bedMinutes) &&
    schedule.bedMinutes >= 0 &&
    schedule.bedMinutes <= 59 &&
    Number.isInteger(schedule.wakeHours) &&
    schedule.wakeHours >= 0 &&
    schedule.wakeHours <= 23 &&
    Number.isInteger(schedule.wakeMinutes) &&
    schedule.wakeMinutes >= 0 &&
    schedule.wakeMinutes <= 59
  );
}

// One reusable row for each reminder switch.
function ReminderRow({
  icon,
  title,
  description,
  value,
  onValueChange,
  disabled,
}) {
  return (
    <View style={styles.reminderRow}>
      <View style={styles.reminderIcon}>
        <Ionicons name={icon} size={22} color="#466B58" />
      </View>

      <View style={styles.reminderTextContainer}>
        <Text style={styles.reminderTitle}>{title}</Text>
        <Text style={styles.reminderDescription}>
          {description}
        </Text>
      </View>

      <Switch
        value={value}
        onValueChange={onValueChange}
        disabled={disabled}
        trackColor={{
          false: '#D7D9D5',
          true: '#9BB49C',
        }}
        thumbColor={value ? '#466B58' : '#F4F4F4'}
      />
    </View>
  );
}

export default function NotificationsScreen({ navigation, route }) {
  const user = route?.params?.user || {};

  // Keep each account's preferences separate.
  const participantId =
    user.participant_id || route?.params?.participant_id;

  const accountKey =
    participantId || user.email || 'guest';

  const storageKey = `s9_notifications_${accountKey}`;
  const scheduledIdsKey = `${storageKey}_scheduled_ids`;

  // Store the bedtime notification separately from daily reminders.
  const bedtimeScheduledIdKey =
    `${storageKey}_bedtime_scheduled_id`;

  // Keep compatibility with the keys used by SleepBetterScreen.
  const sleepScheduleKey = participantId
    ? `@s9_sleep_schedule_${participantId}`
    : '@s9_sleep_schedule';

  const [settings, setSettings] = useState(DEFAULT_SETTINGS);
  const [loading, setLoading] = useState(true);
  const [showTimePicker, setShowTimePicker] = useState(false);
  const [selectedTime, setSelectedTime] = useState(
    createTimeDate('19:00')
  );
  const [updatingReminders, setUpdatingReminders] = useState(false);
  const [testingNotification, setTestingNotification] = useState(false);
  const [updatingBedtimeReminder, setUpdatingBedtimeReminder] =
    useState(false);

  // Prevent overlapping reminder updates.
  const updatingRef = useRef(false);
  const bedtimeUpdatingRef = useRef(false);

  useEffect(() => {
    loadSettings();
  }, [storageKey]);

  // Load this account's saved preferences.
  async function loadSettings() {
    setLoading(true);

    try {
      const saved = await AsyncStorage.getItem(storageKey);

      const loadedSettings = saved
        ? { ...DEFAULT_SETTINGS, ...JSON.parse(saved) }
        : { ...DEFAULT_SETTINGS };

      setSettings(loadedSettings);
      setSelectedTime(createTimeDate(loadedSettings.reminderTime));
    } catch (error) {
      console.error('Could not load notification settings:', error);

      setSettings({ ...DEFAULT_SETTINGS });
      setSelectedTime(createTimeDate('19:00'));

      Alert.alert(
        'Unable to load settings',
        'Your notification preferences could not be loaded.'
      );
    } finally {
      setLoading(false);
    }
  }

  // Save preferences on this device.
  async function saveSettings(updatedSettings) {
    try {
      await AsyncStorage.setItem(
        storageKey,
        JSON.stringify(updatedSettings)
      );
      return true;
    } catch (error) {
      console.error('Could not save notification settings:', error);

      Alert.alert(
        'Save failed',
        'Your notification settings could not be saved.'
      );
      return false;
    }
  }

  // Check whether notifications are allowed.
  async function getNotificationPermission() {
    try {
      let permission = await Notifications.getPermissionsAsync();

      if (!permission.granted) {
        permission = await Notifications.requestPermissionsAsync();
      }

      return permission.granted;
    } catch (error) {
      console.error('Could not check notification permission:', error);

      Alert.alert(
        'Notifications unavailable',
        'Unable to check notification permission on this device.'
      );
      return false;
    }
  }

  // Cancel the reminders previously saved for this account.
  // This function only handles the three regular daily reminders.
  async function cancelSavedReminders() {
    try {
      const savedIds = await AsyncStorage.getItem(scheduledIdsKey);
      const ids = savedIds ? JSON.parse(savedIds) : [];

      if (Array.isArray(ids)) {
        for (const id of ids) {
          try {
            await Notifications.cancelScheduledNotificationAsync(id);
          } catch (error) {
            console.warn('Could not cancel an old reminder:', error);
          }
        }
      }

      await AsyncStorage.removeItem(scheduledIdsKey);
    } catch (error) {
      console.error('Could not cancel saved reminders:', error);
    }
  }

  // Cancel only the bedtime notification.
  async function cancelBedtimeReminder() {
    try {
      const savedId = await AsyncStorage.getItem(
        bedtimeScheduledIdKey
      );

      if (savedId) {
        try {
          await Notifications.cancelScheduledNotificationAsync(
            savedId
          );
        } catch (error) {
          console.warn(
            'Could not cancel the previous bedtime reminder:',
            error
          );
        }
      }

      await AsyncStorage.removeItem(bedtimeScheduledIdKey);
      return true;
    } catch (error) {
      console.error('Could not cancel bedtime reminder:', error);
      return false;
    }
  }

  // Read and validate the sleep schedule saved by Sleep Better.
  async function getSavedSleepSchedule() {
    try {
      let savedSchedule = await AsyncStorage.getItem(
        sleepScheduleKey
      );

      // Support the original shared key if a participant-specific
      // schedule has not been saved yet.
      if (!savedSchedule && participantId) {
        savedSchedule = await AsyncStorage.getItem(
          '@s9_sleep_schedule'
        );
      }

      if (!savedSchedule) {
        return null;
      }

      const schedule = JSON.parse(savedSchedule);

      return isValidSleepSchedule(schedule) ? schedule : null;
    } catch (error) {
      console.error('Could not read saved sleep schedule:', error);
      return null;
    }
  }

  // Schedule a daily bedtime reminder using the saved bedtime.
  async function scheduleBedtimeReminder() {
    let newId = null;

    try {
      const schedule = await getSavedSleepSchedule();

      if (!schedule) {
        Alert.alert(
          'Set your bedtime first',
          'Open Sleep Better and save your bedtime before enabling the bedtime reminder.'
        );
        return false;
      }

      const permitted = await getNotificationPermission();

      if (!permitted) {
        Alert.alert(
          'Permission needed',
          'Allow notifications in your device settings to receive a bedtime reminder.'
        );
        return false;
      }

      // Remove only the previous bedtime notification.
      const cancelled = await cancelBedtimeReminder();

      if (!cancelled) {
        Alert.alert(
          'Unable to update reminder',
          'The previous bedtime reminder could not be cleared. Please try again.'
        );
        return false;
      }

      newId = await Notifications.scheduleNotificationAsync({
        content: {
          title: 'Time to Get Ready for Bed',
          body: 'Your planned bedtime has arrived. Start winding down for the night.',
          sound: true,
          data: { screen: 'SleepBetter' },
        },
        trigger: {
          type: 'daily',
          hour: schedule.bedHours,
          minute: schedule.bedMinutes,
        },
      });

      await AsyncStorage.setItem(
        bedtimeScheduledIdKey,
        newId
      );

      return true;
    } catch (error) {
      console.error('Could not schedule bedtime reminder:', error);

      if (newId) {
        try {
          await Notifications.cancelScheduledNotificationAsync(
            newId
          );
        } catch (cancelError) {
          console.warn(
            'Could not clean up bedtime reminder:',
            cancelError
          );
        }
      }

      await AsyncStorage.removeItem(
        bedtimeScheduledIdKey
      ).catch(() => {});

      Alert.alert(
        'Scheduling failed',
        'Your bedtime reminder could not be scheduled. Please try again.'
      );

      return false;
    }
  }

  // Handle the bedtime switch independently of regular reminders.
  async function updateBedtimeReminder(value) {
    if (
      bedtimeUpdatingRef.current ||
      updatingRef.current ||
      loading
    ) {
      return;
    }

    bedtimeUpdatingRef.current = true;
    setUpdatingBedtimeReminder(true);

    const previousSettings = settings;

    try {
      if (!value) {
        const cancelled = await cancelBedtimeReminder();

        if (!cancelled) {
          Alert.alert(
            'Unable to cancel reminder',
            'The bedtime reminder could not be cancelled. Please try again.'
          );
          return;
        }

        const updatedSettings = {
          ...settings,
          bedTimeReminder: false,
        };

        const saved = await saveSettings(updatedSettings);

        if (saved) {
          setSettings(updatedSettings);
          Alert.alert(
            'Bedtime reminder turned off',
            'Your bedtime reminder has been cancelled.'
          );
        } else {
          setSettings(previousSettings);
        }

        return;
      }

      // Check that a bedtime exists before saving the toggle as enabled.
      const schedule = await getSavedSleepSchedule();

      if (!schedule) {
        Alert.alert(
          'Set your bedtime first',
          'Open Sleep Better, choose your bedtime, and then return here to enable the reminder.'
        );
        return;
      }

      const permitted = await getNotificationPermission();

      if (!permitted) {
        Alert.alert(
          'Permission needed',
          'Enable notifications for this app in your device settings before turning on the bedtime reminder.'
        );
        return;
      }

      const updatedSettings = {
        ...settings,
        bedTimeReminder: true,
      };

      const saved = await saveSettings(updatedSettings);

      if (!saved) {
        setSettings(previousSettings);
        return;
      }

      setSettings(updatedSettings);

      const scheduled = await scheduleBedtimeReminder();

      if (!scheduled) {
        // Do not leave the switch enabled if scheduling failed.
        const revertedSettings = {
          ...updatedSettings,
          bedTimeReminder: false,
        };

        await saveSettings(revertedSettings);
        setSettings(revertedSettings);
        return;
      }

      const bedtimeText = createTimeDate(
        `${String(schedule.bedHours).padStart(2, '0')}:${String(
          schedule.bedMinutes
        ).padStart(2, '0')}`
      ).toLocaleTimeString([], {
        hour: 'numeric',
        minute: '2-digit',
      });

      Alert.alert(
        'Bedtime reminder enabled',
        `You'll receive a daily reminder at ${bedtimeText}. Change your bedtime in Sleep Better whenever your routine changes.`
      );
    } catch (error) {
      console.error('Could not update bedtime reminder:', error);

      setSettings(previousSettings);

      Alert.alert(
        'Unable to update reminder',
        'Your bedtime reminder could not be updated. Please try again.'
      );
    } finally {
      bedtimeUpdatingRef.current = false;
      setUpdatingBedtimeReminder(false);
    }
  }

  // Create the reminders that are currently switched on.
  // The bedtime reminder is deliberately excluded from this list.
  function getEnabledReminders(updatedSettings) {
    const reminders = [];

    if (updatedSettings.moodReminders) {
      reminders.push({
        title: 'Time for a Mood Check-In',
        body: 'Take a moment to check in with how you are feeling.',
      });
    }

    if (updatedSettings.wellnessReminders) {
      reminders.push({
        title: 'Your Daily Wellness Reminder',
        body: 'Take a little time for your wellbeing today.',
      });
    }

    if (updatedSettings.studyReminders) {
      reminders.push({
        title: 'Time for a Study Break',
        body: 'Pause, stretch, and give your mind a short break.',
      });
    }

    return reminders;
  }

  // Cancel old regular reminders and schedule the newly selected ones.
  async function scheduleDailyReminders(updatedSettings) {
    if (updatingRef.current) {
      return false;
    }

    updatingRef.current = true;
    setUpdatingReminders(true);

    const newIds = [];

    try {
      await cancelSavedReminders();

      const reminders = getEnabledReminders(updatedSettings);

      // If all regular reminder switches are off, no daily reminders
      // in this group are needed. The bedtime reminder remains separate.
      if (reminders.length === 0) {
        Alert.alert(
          'Daily reminders turned off',
          'Your regular daily reminders have been cancelled.'
        );
        return true;
      }

      const permitted = await getNotificationPermission();

      if (!permitted) {
        Alert.alert(
          'Permission needed',
          'Allow notifications in your device settings to receive daily reminders.'
        );
        return false;
      }

      const [hour, minute] = updatedSettings.reminderTime
        .split(':')
        .map(Number);

      const validTime =
        Number.isInteger(hour) &&
        hour >= 0 &&
        hour <= 23 &&
        Number.isInteger(minute) &&
        minute >= 0 &&
        minute <= 59;

      if (!validTime) {
        Alert.alert(
          'Invalid time',
          'Please select a valid reminder time.'
        );
        return false;
      }

      for (const reminder of reminders) {
        const id = await Notifications.scheduleNotificationAsync({
          content: {
            title: reminder.title,
            body: reminder.body,
            sound: true,
            data: { screen: 'Notifications' },
          },
          trigger: {
            type: 'daily',
            hour,
            minute,
          },
        });

        newIds.push(id);
      }

      // Store only the IDs for these regular reminders.
      await AsyncStorage.setItem(
        scheduledIdsKey,
        JSON.stringify(newIds)
      );

      Alert.alert(
        'Reminders scheduled',
        `${newIds.length} daily reminder(s) scheduled for ${formatTime(
          updatedSettings.reminderTime
        )}.`
      );

      return true;
    } catch (error) {
      console.error('Could not schedule daily reminders:', error);

      // Remove any reminders created before the error occurred.
      for (const id of newIds) {
        try {
          await Notifications.cancelScheduledNotificationAsync(id);
        } catch (cancelError) {
          console.warn('Could not clean up reminder:', cancelError);
        }
      }

      await AsyncStorage.removeItem(scheduledIdsKey).catch(() => {});

      Alert.alert(
        'Scheduling failed',
        'Your reminders could not be scheduled. Please try again.'
      );

      return false;
    } finally {
      updatingRef.current = false;
      setUpdatingReminders(false);
    }
  }

  // Save a regular reminder switch change and update those reminders.
  async function updateToggle(key, value) {
    if (
      updatingRef.current ||
      bedtimeUpdatingRef.current ||
      loading
    ) {
      return;
    }

    const previousSettings = settings;
    const updatedSettings = {
      ...settings,
      [key]: value,
    };

    setSettings(updatedSettings);

    const saved = await saveSettings(updatedSettings);

    if (!saved) {
      setSettings(previousSettings);
      return;
    }

    await scheduleDailyReminders(updatedSettings);
  }

  // Handle time picker changes on both iOS and Android.
  function handleTimeChange(...args) {
    const date = args.length > 1 ? args[1] : args[0];

    if (!(date instanceof Date) || Number.isNaN(date.getTime())) {
      setShowTimePicker(false);
      return;
    }

    setSelectedTime(date);

    // Android confirms the time directly in its picker.
    if (Platform.OS !== 'ios') {
      setShowTimePicker(false);
      applySelectedTime(date);
    }
  }

  // Save the selected time and reschedule enabled regular reminders.
  async function applySelectedTime(time = selectedTime) {
    if (
      updatingRef.current ||
      bedtimeUpdatingRef.current ||
      loading
    ) {
      return;
    }

    const reminderTime = [
      String(time.getHours()).padStart(2, '0'),
      String(time.getMinutes()).padStart(2, '0'),
    ].join(':');

    const updatedSettings = {
      ...settings,
      reminderTime,
    };

    setSettings(updatedSettings);

    const saved = await saveSettings(updatedSettings);

    if (saved) {
      await scheduleDailyReminders(updatedSettings);
    }
  }

  // Let the user check or request notification permission.
  async function enableNotifications() {
    const permitted = await getNotificationPermission();

    Alert.alert(
      permitted ? 'Notifications enabled' : 'Permission not granted',
      permitted
        ? 'You can now receive reminders that you have enabled.'
        : 'Enable notifications for this app in your device settings.'
    );
  }

  // Schedule a one-time notification five seconds from now.
  async function testNotification() {
    if (testingNotification) {
      return;
    }

    setTestingNotification(true);

    try {
      const permitted = await getNotificationPermission();

      if (!permitted) {
        Alert.alert(
          'Permission needed',
          'Allow notifications before running this test.'
        );
        return;
      }

      await Notifications.scheduleNotificationAsync({
        content: {
          title: 'S9 Wellness Support',
          body: 'Your test notification is working!',
          sound: true,
        },
        trigger: {
          type: 'timeInterval',
          seconds: 5,
        },
      });

      Alert.alert(
        'Test scheduled',
        'A notification should appear in about five seconds. Try putting the app in the background.'
      );
    } catch (error) {
      console.error('Test notification failed:', error);

      Alert.alert(
        'Test failed',
        'The test notification could not be scheduled. Check the console for details.'
      );
    } finally {
      setTestingNotification(false);
    }
  }

  const reminderControlsDisabled =
    loading || updatingReminders || updatingBedtimeReminder;

  return (
    <View style={styles.container}>
      <StatusBar barStyle="dark-content" backgroundColor="#F4EFE8" />

      <View style={styles.header}>
        <TouchableOpacity
          style={styles.backButton}
          onPress={() => navigation.goBack()}
          accessibilityLabel="Go back"
        >
          <Ionicons name="arrow-back" size={23} color="#263D39" />
        </TouchableOpacity>

        <Text style={styles.headerTitle}>Notifications</Text>

        <View style={styles.headerPlaceholder} />
      </View>

      {loading ? (
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color="#466B58" />
          <Text style={styles.loadingText}>
            Loading your preferences...
          </Text>
        </View>
      ) : (
        <ScrollView
          contentContainerStyle={styles.scrollContent}
          showsVerticalScrollIndicator={false}
        >
          <View style={styles.intro}>
            <View style={styles.introIcon}>
              <Ionicons
                name="notifications-outline"
                size={30}
                color="#466B58"
              />
            </View>

            <Text style={styles.title}>
              Stay on track with your wellbeing
            </Text>

            <Text style={styles.subtitle}>
              Choose which reminders you'd like to receive and when
              you'd like to receive them.
            </Text>
          </View>

          <Text style={styles.sectionTitle}>DAILY REMINDERS</Text>

          <View style={styles.card}>
            <ReminderRow
              icon="happy-outline"
              title="Mood Check-In"
              description="Remember to record how you're feeling."
              value={settings.moodReminders}
              onValueChange={(value) =>
                updateToggle('moodReminders', value)
              }
              disabled={reminderControlsDisabled}
            />

            <View style={styles.separator} />

            <ReminderRow
              icon="leaf-outline"
              title="Wellness Reminder"
              description="Take a moment for yourself each day."
              value={settings.wellnessReminders}
              onValueChange={(value) =>
                updateToggle('wellnessReminders', value)
              }
              disabled={reminderControlsDisabled}
            />

            <View style={styles.separator} />

            <ReminderRow
              icon="book-outline"
              title="Study Breaks"
              description="Remember to pause and recharge while studying."
              value={settings.studyReminders}
              onValueChange={(value) =>
                updateToggle('studyReminders', value)
              }
              disabled={reminderControlsDisabled}
            />

            <View style={styles.separator} />

            <ReminderRow
              icon="moon-outline"
              title="Bedtime Reminder"
              description="Get a gentle reminder at the bedtime saved in Sleep Better."
              value={Boolean(settings.bedTimeReminder)}
              onValueChange={updateBedtimeReminder}
              disabled={reminderControlsDisabled}
            />
          </View>

          <Text style={styles.sectionTitle}>REMINDER TIME</Text>

          <TouchableOpacity
            style={styles.timeCard}
            onPress={() => setShowTimePicker(true)}
            disabled={reminderControlsDisabled}
            activeOpacity={0.75}
          >
            <View style={styles.timeIcon}>
              <Ionicons
                name="time-outline"
                size={23}
                color="#466B58"
              />
            </View>

            <View style={styles.timeTextContainer}>
              <Text style={styles.timeTitle}>Daily reminder time</Text>
              <Text style={styles.timeDescription}>
                Reminders use your device's local time.
              </Text>
            </View>

            <Text style={styles.timeValue}>
              {formatTime(settings.reminderTime)}
            </Text>

            <Ionicons
              name="chevron-forward"
              size={19}
              color="#7B8583"
            />
          </TouchableOpacity>

          {showTimePicker && (
            <View style={styles.pickerContainer}>
              <DateTimePicker
                value={selectedTime}
                mode="time"
                display={Platform.OS === 'ios' ? 'spinner' : 'default'}
                onChange={handleTimeChange}
                onDismiss={() => setShowTimePicker(false)}
              />

              {Platform.OS === 'ios' && (
                <TouchableOpacity
                  style={styles.doneButton}
                  onPress={async () => {
                    setShowTimePicker(false);
                    await applySelectedTime(selectedTime);
                  }}
                >
                  <Text style={styles.doneButtonText}>Done</Text>
                </TouchableOpacity>
              )}
            </View>
          )}

          <TouchableOpacity
            style={styles.permissionButton}
            onPress={enableNotifications}
            disabled={reminderControlsDisabled}
            activeOpacity={0.8}
          >
            <Ionicons
              name="notifications-outline"
              size={19}
              color="#466B58"
            />
            <Text style={styles.permissionButtonText}>
              Check Notification Permission
            </Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={[
              styles.testButton,
              testingNotification && styles.disabledButton,
            ]}
            onPress={testNotification}
            disabled={testingNotification}
            activeOpacity={0.8}
          >
            {testingNotification ? (
              <ActivityIndicator color="#FFFFFF" />
            ) : (
              <Ionicons
                name="paper-plane-outline"
                size={19}
                color="#FFFFFF"
              />
            )}

            <Text style={styles.testButtonText}>
              {testingNotification
                ? 'Scheduling test...'
                : 'Test Notification (5 seconds)'}
            </Text>
          </TouchableOpacity>

          {(updatingReminders || updatingBedtimeReminder) && (
            <View style={styles.updatingContainer}>
              <ActivityIndicator size="small" color="#466B58" />
              <Text style={styles.updatingText}>
                Updating your reminders...
              </Text>
            </View>
          )}

          <View style={styles.infoCard}>
            <Ionicons
              name="information-circle-outline"
              size={21}
              color="#466B58"
            />

            <Text style={styles.infoText}>
              These are local reminders scheduled on this device.
              They do not require the Flask backend. Your bedtime
              reminder follows the bedtime saved in Sleep Better.
              Make sure notifications are allowed in your device
              settings.
            </Text>
          </View>

          <Text style={styles.footer}>
            Small steps towards a healthier, more balanced day.
          </Text>
        </ScrollView>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F4EFE8',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingTop: Platform.OS === 'ios' ? 58 : 24,
    paddingBottom: 16,
  },
  backButton: {
    width: 42,
    height: 42,
    borderRadius: 14,
    backgroundColor: '#FFFFFF',
    justifyContent: 'center',
    alignItems: 'center',
  },
  headerTitle: {
    fontSize: 20,
    fontWeight: '700',
    color: '#263D39',
  },
  headerPlaceholder: {
    width: 42,
  },
  scrollContent: {
    paddingHorizontal: 20,
    paddingBottom: 35,
  },
  loadingContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  loadingText: {
    marginTop: 12,
    color: '#7B8583',
    fontSize: 14,
  },
  intro: {
    alignItems: 'center',
    marginTop: 12,
    marginBottom: 30,
  },
  introIcon: {
    width: 66,
    height: 66,
    borderRadius: 23,
    backgroundColor: '#E4E9DF',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 16,
  },
  title: {
    color: '#263D39',
    fontSize: 23,
    fontWeight: '700',
    textAlign: 'center',
    marginBottom: 10,
  },
  subtitle: {
    color: '#7B8583',
    fontSize: 14,
    lineHeight: 21,
    textAlign: 'center',
    paddingHorizontal: 8,
  },
  sectionTitle: {
    color: '#7B8583',
    fontSize: 12,
    fontWeight: '700',
    letterSpacing: 1.1,
    marginBottom: 12,
    marginTop: 5,
  },
  card: {
    backgroundColor: '#FFFFFF',
    borderRadius: 20,
    paddingHorizontal: 15,
    marginBottom: 25,
  },
  reminderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 17,
  },
  reminderIcon: {
    width: 43,
    height: 43,
    borderRadius: 14,
    backgroundColor: '#EAF0E8',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12,
  },
  reminderTextContainer: {
    flex: 1,
    paddingRight: 8,
  },
  reminderTitle: {
    fontSize: 15,
    fontWeight: '600',
    color: '#263D39',
    marginBottom: 4,
  },
  reminderDescription: {
    fontSize: 12,
    lineHeight: 17,
    color: '#7B8583',
  },
  separator: {
    height: 1,
    backgroundColor: '#F0F0ED',
  },
  timeCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
    padding: 15,
    borderRadius: 18,
    marginBottom: 15,
  },
  timeIcon: {
    width: 43,
    height: 43,
    borderRadius: 14,
    backgroundColor: '#EAF0E8',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12,
  },
  timeTextContainer: {
    flex: 1,
  },
  timeTitle: {
    color: '#263D39',
    fontSize: 14,
    fontWeight: '600',
    marginBottom: 4,
  },
  timeDescription: {
    color: '#7B8583',
    fontSize: 11,
    lineHeight: 16,
  },
  timeValue: {
    color: '#466B58',
    fontSize: 14,
    fontWeight: '700',
    marginRight: 8,
  },
  pickerContainer: {
    backgroundColor: '#FFFFFF',
    borderRadius: 18,
    padding: 12,
    marginBottom: 15,
  },
  doneButton: {
    alignSelf: 'flex-end',
    backgroundColor: '#466B58',
    paddingHorizontal: 24,
    paddingVertical: 10,
    borderRadius: 12,
    marginTop: 8,
  },
  doneButtonText: {
    color: '#FFFFFF',
    fontWeight: '700',
    fontSize: 14,
  },
  permissionButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#E5EAE0',
    borderRadius: 15,
    paddingVertical: 15,
    paddingHorizontal: 12,
    marginTop: 10,
    marginBottom: 12,
  },
  permissionButtonText: {
    color: '#466B58',
    fontSize: 14,
    fontWeight: '600',
    marginLeft: 9,
  },
  testButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#466B58',
    borderRadius: 15,
    paddingVertical: 16,
    paddingHorizontal: 12,
  },
  disabledButton: {
    opacity: 0.65,
  },
  testButtonText: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: '700',
    marginLeft: 9,
  },
  updatingContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 14,
  },
  updatingText: {
    color: '#7B8583',
    fontSize: 12,
    marginLeft: 8,
  },
  infoCard: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    backgroundColor: '#E8EDE4',
    padding: 15,
    borderRadius: 16,
    marginTop: 22,
  },
  infoText: {
    flex: 1,
    color: '#52645A',
    fontSize: 12,
    lineHeight: 18,
    marginLeft: 10,
  },
  footer: {
    color: '#8A918B',
    textAlign: 'center',
    fontSize: 12,
    lineHeight: 18,
    marginTop: 22,
    paddingHorizontal: 12,
  },
});