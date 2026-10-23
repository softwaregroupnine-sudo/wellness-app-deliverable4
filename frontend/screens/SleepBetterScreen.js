import React, { useEffect, useState } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import DateTimePicker from '@react-native-community/datetimepicker';
import * as Notifications from 'expo-notifications';

import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
} from 'react-native';

const SLEEP_CHECKLIST = [
  {
    id: 'study',
    title: 'Put away study work',
    description: 'Give yourself permission to stop working for today.',
  },
  {
    id: 'screens',
    title: 'Reduce screen time',
    description: 'Try putting your phone away before bedtime.',
  },
  {
    id: 'space',
    title: 'Prepare your space',
    description: 'Make your room comfortable, quiet and relaxing.',
  },
  {
    id: 'relax',
    title: 'Relax your body',
    description: 'Take a few slow breaths and release some tension.',
  },
];

const SLEEP_TIPS = [
  {
    title: 'Keep a regular routine',
    description:
      'Try to go to bed and wake up at similar times each day.',
  },
  {
    title: 'Be mindful of caffeine',
    description:
      'Coffee, energy drinks and other caffeinated drinks late in the day may make it harder to fall asleep.',
  },
  {
    title: 'Give yourself time to unwind',
    description:
      'Choose a quiet activity before bed, such as reading, gentle stretching or listening to calming music.',
  },
];

function createTime(hours, minutes) {
  const time = new Date();
  time.setHours(hours, minutes, 0, 0);
  return time;
}

function formatTime(time) {
  return time.toLocaleTimeString([], {
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  });
}

function calculateSleepDuration(bedTime, wakeTime) {
  const bedMinutes =
    bedTime.getHours() * 60 + bedTime.getMinutes();

  const wakeMinutes =
    wakeTime.getHours() * 60 + wakeTime.getMinutes();

  let duration = wakeMinutes - bedMinutes;

  // The wake-up time may fall on the following day.
  if (duration <= 0) {
    duration += 24 * 60;
  }

  return {
    hours: Math.floor(duration / 60),
    minutes: duration % 60,
  };
}

function formatDuration(hours, minutes) {
  const hourText = `${hours} ${hours === 1 ? 'hour' : 'hours'}`;

  if (minutes === 0) {
    return hourText;
  }

  return `${hourText} ${minutes} min`;
}

export default function SleepBetterScreen({ navigation, route }) {
  const [completedItems, setCompletedItems] = useState([]);
  const [bedTime, setBedTime] = useState(() => createTime(22, 0));
  const [wakeTime, setWakeTime] = useState(() => createTime(6, 0));

  const [isLoaded, setIsLoaded] = useState(false);
  const [pickerMode, setPickerMode] = useState(null);

  const user = route?.params?.user || {};

  const participantId =
    user.participant_id ||
    route?.params?.participant_id;

  const accountKey =
    participantId || user.email || 'guest';

  const storageKey = participantId
    ? `@s9_sleep_checklist_${participantId}`
    : '@s9_sleep_checklist';

  // Preserve the existing sleep schedule storage keys.
  const scheduleKey = participantId
    ? `@s9_sleep_schedule_${participantId}`
    : '@s9_sleep_schedule';

  // These keys must match NotificationsScreen.
  const notificationSettingsKey =
    `s9_notifications_${accountKey}`;

  const bedtimeScheduledIdKey =
    `${notificationSettingsKey}_bedtime_scheduled_id`;

  // Load the checklist and sleep schedule from local storage.
  useEffect(() => {
    let isActive = true;

    async function loadSavedData() {
      setIsLoaded(false);

      try {
        const [savedChecklist, savedSchedule] = await Promise.all([
          AsyncStorage.getItem(storageKey),
          AsyncStorage.getItem(scheduleKey),
        ]);

        if (!isActive) {
          return;
        }

        if (savedChecklist !== null) {
          const parsedItems = JSON.parse(savedChecklist);

          if (Array.isArray(parsedItems)) {
            setCompletedItems(
              parsedItems.filter((id) =>
                SLEEP_CHECKLIST.some((item) => item.id === id)
              )
            );
          } else {
            setCompletedItems([]);
          }
        } else {
          setCompletedItems([]);
        }

        if (savedSchedule !== null) {
          const schedule = JSON.parse(savedSchedule);

          if (
            Number.isInteger(schedule.bedHours) &&
            Number.isInteger(schedule.bedMinutes) &&
            Number.isInteger(schedule.wakeHours) &&
            Number.isInteger(schedule.wakeMinutes) &&
            schedule.bedHours >= 0 &&
            schedule.bedHours <= 23 &&
            schedule.wakeHours >= 0 &&
            schedule.wakeHours <= 23 &&
            schedule.bedMinutes >= 0 &&
            schedule.bedMinutes <= 59 &&
            schedule.wakeMinutes >= 0 &&
            schedule.wakeMinutes <= 59
          ) {
            setBedTime(
              createTime(schedule.bedHours, schedule.bedMinutes)
            );

            setWakeTime(
              createTime(schedule.wakeHours, schedule.wakeMinutes)
            );
          }
        }
      } catch (error) {
        console.warn('Could not load saved sleep data:', error);
      } finally {
        if (isActive) {
          setIsLoaded(true);
        }
      }
    }

    loadSavedData();

    return () => {
      isActive = false;
    };
  }, [storageKey, scheduleKey]);

  // Save checklist progress and sleep times whenever they change.
  useEffect(() => {
    if (!isLoaded) {
      return;
    }

    async function saveData() {
      try {
        await Promise.all([
          AsyncStorage.setItem(
            storageKey,
            JSON.stringify(completedItems)
          ),
          AsyncStorage.setItem(
            scheduleKey,
            JSON.stringify({
              bedHours: bedTime.getHours(),
              bedMinutes: bedTime.getMinutes(),
              wakeHours: wakeTime.getHours(),
              wakeMinutes: wakeTime.getMinutes(),
            })
          ),
        ]);
      } catch (error) {
        console.warn('Could not save sleep data:', error);
      }
    }

    saveData();
  }, [
    completedItems,
    bedTime,
    wakeTime,
    isLoaded,
    storageKey,
    scheduleKey,
  ]);

  // Keep the scheduled bedtime notification in sync with the
  // saved bedtime, but only when the user has enabled the reminder.
  useEffect(() => {
    if (!isLoaded) {
      return;
    }

    let isActive = true;

    async function syncBedtimeReminder() {
      try {
        const savedSettings = await AsyncStorage.getItem(
          notificationSettingsKey
        );

        if (!isActive || !savedSettings) {
          return;
        }

        let parsedSettings;

        try {
          parsedSettings = JSON.parse(savedSettings);
        } catch (error) {
          console.warn(
            'Could not read notification preferences:',
            error
          );
          return;
        }

        // Do not create notifications unless the user enabled them.
        if (parsedSettings.bedTimeReminder !== true) {
          return;
        }

        // Do not repeatedly request permission when the bedtime changes.
        const permission =
          await Notifications.getPermissionsAsync();

        if (!isActive || !permission.granted) {
          return;
        }

        // Cancel only the previous bedtime notification.
        // Regular mood, wellness and study reminders are untouched.
        const previousId = await AsyncStorage.getItem(
          bedtimeScheduledIdKey
        );

        if (previousId) {
          try {
            await Notifications.cancelScheduledNotificationAsync(
              previousId
            );
          } catch (error) {
            console.warn(
              'Could not cancel the previous bedtime reminder:',
              error
            );
          }
        }

        await AsyncStorage.removeItem(bedtimeScheduledIdKey);

        if (!isActive) {
          return;
        }

        const newId =
          await Notifications.scheduleNotificationAsync({
            content: {
              title: 'Time to Get Ready for Bed',
              body: 'Your planned bedtime has arrived. Start winding down for the night.',
              sound: true,
              data: { screen: 'SleepBetter' },
            },
            trigger: {
              type: 'daily',
              hour: bedTime.getHours(),
              minute: bedTime.getMinutes(),
            },
          });

        if (!isActive) {
          // The screen may have been left while scheduling.
          // Cancel the new notification rather than leave it unsaved.
          await Notifications.cancelScheduledNotificationAsync(
            newId
          );
          return;
        }

        await AsyncStorage.setItem(
          bedtimeScheduledIdKey,
          newId
        );
      } catch (error) {
        console.warn(
          'Could not synchronise bedtime reminder:',
          error
        );
      }
    }

    syncBedtimeReminder();

    return () => {
      isActive = false;
    };
  }, [
    bedTime,
    isLoaded,
    notificationSettingsKey,
    bedtimeScheduledIdKey,
  ]);

  const completedCount = completedItems.length;
  const totalItems = SLEEP_CHECKLIST.length;
  const progress = completedCount / totalItems;
  const allCompleted = completedCount === totalItems;

  const sleepDuration = calculateSleepDuration(bedTime, wakeTime);

  function toggleChecklistItem(itemId) {
    if (!isLoaded) {
      return;
    }

    setCompletedItems((previousItems) => {
      if (previousItems.includes(itemId)) {
        return previousItems.filter((id) => id !== itemId);
      }

      return [...previousItems, itemId];
    });
  }

  function resetChecklist() {
    if (isLoaded) {
      setCompletedItems([]);
    }
  }

  function openBreathingExercise() {
    navigation.navigate('BreathingExercise');
  }

  function handleTimeChange(event, selectedTime) {
    setPickerMode(null);

    if (event.type === 'dismissed' || !selectedTime) {
      return;
    }

    if (pickerMode === 'bed') {
      setBedTime(selectedTime);
    } else if (pickerMode === 'wake') {
      setWakeTime(selectedTime);
    }
  }

  return (
    <View style={styles.container}>
      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={styles.scrollContent}
      >
        {/* Page heading */}
        <View style={styles.header}>
          <Text style={styles.headerIcon}>☾</Text>

          <View style={styles.headerTextContainer}>
            <Text style={styles.headerTitle}>Sleep Better</Text>
            <Text style={styles.headerSubtitle}>
              Create a calmer bedtime routine.
            </Text>
          </View>
        </View>

        {/* Introduction */}
        <View style={styles.introCard}>
          <View style={styles.introIconCircle}>
            <Text style={styles.introIcon}>🌙</Text>
          </View>

          <Text style={styles.introTitle}>
            Give yourself time to unwind.
          </Text>

          <Text style={styles.introDescription}>
            You don't have to complete everything perfectly. Start
            with one small change that helps you feel more relaxed
            before bed.
          </Text>
        </View>

        {/* Sleep schedule */}
        <View style={styles.sectionHeading}>
          <Text style={styles.sectionTitle}>Your sleep schedule</Text>
          <Text style={styles.sectionSubtitle}>
            Set your usual bedtime and wake-up time.
          </Text>
        </View>

        <View style={styles.scheduleCard}>
          <View style={styles.timeRow}>
            <View style={styles.timeIconCircle}>
              <Text style={styles.timeIcon}>🌙</Text>
            </View>

            <View style={styles.timeTextContainer}>
              <Text style={styles.timeLabel}>Bedtime</Text>
              <Text style={styles.timeDescription}>
                When do you usually go to bed?
              </Text>
            </View>

            <TouchableOpacity
              style={styles.timeButton}
              onPress={() => setPickerMode('bed')}
              disabled={!isLoaded}
              activeOpacity={0.75}
              accessibilityRole="button"
              accessibilityLabel={`Choose bedtime. Current time ${formatTime(bedTime)}`}
            >
              <Text style={styles.timeButtonText}>
                {formatTime(bedTime)}
              </Text>
            </TouchableOpacity>
          </View>

          <View style={styles.divider} />

          <View style={styles.timeRow}>
            <View style={styles.timeIconCircle}>
              <Text style={styles.timeIcon}>☀️</Text>
            </View>

            <View style={styles.timeTextContainer}>
              <Text style={styles.timeLabel}>Wake-up time</Text>
              <Text style={styles.timeDescription}>
                When do you usually wake up?
              </Text>
            </View>

            <TouchableOpacity
              style={styles.timeButton}
              onPress={() => setPickerMode('wake')}
              disabled={!isLoaded}
              activeOpacity={0.75}
              accessibilityRole="button"
              accessibilityLabel={`Choose wake-up time. Current time ${formatTime(wakeTime)}`}
            >
              <Text style={styles.timeButtonText}>
                {formatTime(wakeTime)}
              </Text>
            </TouchableOpacity>
          </View>

          {pickerMode !== null ? (
            <DateTimePicker
              value={pickerMode === 'bed' ? bedTime : wakeTime}
              mode="time"
              display="default"
              onChange={handleTimeChange}
            />
          ) : null}

          <View style={styles.durationCard}>
            <Text style={styles.durationLabel}>
              Estimated sleep duration
            </Text>

            <Text style={styles.durationValue}>
              {formatDuration(
                sleepDuration.hours,
                sleepDuration.minutes
              )}
            </Text>

            <Text style={styles.durationNote}>
              This is the time between your selected bedtime and
              wake-up time, not a measurement of actual sleep.
            </Text>
          </View>
        </View>

        {/* Interactive checklist */}
        <View style={styles.sectionHeading}>
          <Text style={styles.sectionTitle}>Your bedtime checklist</Text>
          <Text style={styles.sectionSubtitle}>
            Check off each step as you complete it.
          </Text>
        </View>

        <View style={styles.progressCard}>
          <View style={styles.progressHeader}>
            <Text style={styles.progressTitle}>Your progress</Text>

            <Text style={styles.progressCount}>
              {completedCount} of {totalItems}
            </Text>
          </View>

          <View
            style={styles.progressTrack}
            accessibilityRole="progressbar"
            accessibilityValue={{
              min: 0,
              max: totalItems,
              now: completedCount,
            }}
          >
            <View
              style={[
                styles.progressFill,
                { width: `${progress * 100}%` },
              ]}
            />
          </View>

          <Text style={styles.progressMessage}>
            {!isLoaded
              ? 'Loading your saved progress...'
              : allCompleted
                ? 'Well done! You have completed your bedtime checklist.'
                : completedCount === 0
                  ? 'Start with whichever step feels easiest.'
                  : 'Every small step counts. Keep going at your own pace.'}
          </Text>
        </View>

        <View style={styles.checklistCard}>
          {SLEEP_CHECKLIST.map((item, index) => {
            const isCompleted = completedItems.includes(item.id);

            return (
              <React.Fragment key={item.id}>
                {index > 0 ? <View style={styles.divider} /> : null}

                <TouchableOpacity
                  style={styles.checklistRow}
                  onPress={() => toggleChecklistItem(item.id)}
                  disabled={!isLoaded}
                  activeOpacity={0.75}
                  accessibilityRole="checkbox"
                  accessibilityState={{
                    checked: isCompleted,
                    disabled: !isLoaded,
                  }}
                  accessibilityLabel={`${item.title}. ${item.description}`}
                >
                  <View
                    style={[
                      styles.checkbox,
                      isCompleted && styles.checkboxCompleted,
                    ]}
                  >
                    {isCompleted ? (
                      <Text style={styles.checkmark}>✓</Text>
                    ) : null}
                  </View>

                  <View style={styles.checklistTextContainer}>
                    <Text
                      style={[
                        styles.checklistTitle,
                        isCompleted && styles.completedText,
                      ]}
                    >
                      {item.title}
                    </Text>

                    <Text style={styles.checklistDescription}>
                      {item.description}
                    </Text>
                  </View>
                </TouchableOpacity>
              </React.Fragment>
            );
          })}
        </View>

        {completedCount > 0 ? (
          <TouchableOpacity
            style={styles.resetButton}
            onPress={resetChecklist}
            disabled={!isLoaded}
            activeOpacity={0.75}
            accessibilityRole="button"
          >
            <Text style={styles.resetButtonText}>
              Reset checklist
            </Text>
          </TouchableOpacity>
        ) : null}

        {/* Breathing exercise */}
        <View style={styles.breathingCard}>
          <View style={styles.breathingIconCircle}>
            <Text style={styles.breathingIcon}>◉</Text>
          </View>

          <View style={styles.breathingTextContainer}>
            <Text style={styles.breathingTitle}>
              Need help relaxing?
            </Text>

            <Text style={styles.breathingDescription}>
              Try the breathing exercise to slow down and settle
              before bed.
            </Text>
          </View>

          <TouchableOpacity
            style={styles.breathingButton}
            onPress={openBreathingExercise}
            activeOpacity={0.8}
            accessibilityRole="button"
            accessibilityLabel="Open breathing exercise"
          >
            <Text style={styles.breathingButtonText}>Start</Text>
          </TouchableOpacity>
        </View>

        {/* Sleep tips */}
        <View style={styles.sectionHeading}>
          <Text style={styles.sectionTitle}>Small habits, better rest</Text>
          <Text style={styles.sectionSubtitle}>
            A few simple things to try.
          </Text>
        </View>

        <View style={styles.tipsCard}>
          {SLEEP_TIPS.map((tip, index) => (
            <View key={tip.title}>
              {index > 0 ? <View style={styles.divider} /> : null}

              <View style={styles.tipRow}>
                <View style={styles.tipBullet}>
                  <Text style={styles.tipBulletText}>
                    {index + 1}
                  </Text>
                </View>

                <View style={styles.tipTextContainer}>
                  <Text style={styles.tipTitle}>{tip.title}</Text>

                  <Text style={styles.tipDescription}>
                    {tip.description}
                  </Text>
                </View>
              </View>
            </View>
          ))}
        </View>

        {/* Supportive closing note */}
        <View style={styles.closingCard}>
          <Text style={styles.closingTitle}>
            Rest is part of looking after yourself.
          </Text>

          <Text style={styles.closingDescription}>
            Some nights are harder than others. Focus on building
            helpful habits rather than expecting a perfect routine.
          </Text>
        </View>

        <View style={styles.bottomSpace} />
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#DDD5D6',
  },
  scrollContent: {
    paddingHorizontal: 20,
    paddingTop: 25,
    paddingBottom: 30,
  },

  // Header
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 22,
  },
  headerIcon: {
    color: '#5A3B68',
    fontSize: 34,
    marginRight: 12,
  },
  headerTextContainer: {
    flex: 1,
  },
  headerTitle: {
    color: '#31504F',
    fontSize: 22,
    fontWeight: '800',
  },
  headerSubtitle: {
    color: '#706676',
    fontSize: 12,
    marginTop: 4,
  },

  // Introduction
  introCard: {
    backgroundColor: '#AEBBA5',
    borderRadius: 22,
    padding: 20,
    marginBottom: 27,
  },
  introIconCircle: {
    width: 47,
    height: 47,
    borderRadius: 24,
    backgroundColor: '#F5EFF0',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 13,
  },
  introIcon: {
    fontSize: 24,
  },
  introTitle: {
    color: '#5A3B68',
    fontSize: 20,
    lineHeight: 26,
    fontWeight: '800',
  },
  introDescription: {
    color: '#5D5863',
    fontSize: 12,
    lineHeight: 19,
    marginTop: 9,
  },

  // Section headings
  sectionHeading: {
    marginBottom: 12,
    marginTop: 3,
  },
  sectionTitle: {
    color: '#5A3B68',
    fontSize: 17,
    fontWeight: '800',
  },
  sectionSubtitle: {
    color: '#706676',
    fontSize: 12,
    lineHeight: 17,
    marginTop: 5,
  },

  // Sleep schedule
  scheduleCard: {
    backgroundColor: '#F5EFF0',
    borderRadius: 18,
    paddingHorizontal: 15,
    paddingVertical: 5,
    marginBottom: 25,
  },
  timeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 15,
  },
  timeIconCircle: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: '#E5D9E8',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 11,
  },
  timeIcon: {
    fontSize: 19,
  },
  timeTextContainer: {
    flex: 1,
    paddingRight: 5,
  },
  timeLabel: {
    color: '#5A3B68',
    fontSize: 13,
    fontWeight: '800',
  },
  timeDescription: {
    color: '#706676',
    fontSize: 10,
    lineHeight: 15,
    marginTop: 4,
  },
  timeButton: {
    backgroundColor: '#E5D9E8',
    borderRadius: 12,
    paddingVertical: 10,
    paddingHorizontal: 11,
  },
  timeButtonText: {
    color: '#5A3B68',
    fontSize: 14,
    fontWeight: '800',
  },
  durationCard: {
    backgroundColor: '#C9D6C2',
    borderRadius: 15,
    padding: 15,
    alignItems: 'center',
    marginTop: 9,
    marginBottom: 11,
  },
  durationLabel: {
    color: '#31504F',
    fontSize: 12,
    fontWeight: '700',
  },
  durationValue: {
    color: '#31504F',
    fontSize: 23,
    fontWeight: '800',
    marginTop: 6,
  },
  durationNote: {
    color: '#53645A',
    fontSize: 10,
    lineHeight: 15,
    textAlign: 'center',
    marginTop: 7,
  },

  // Progress
  progressCard: {
    backgroundColor: '#F5EFF0',
    borderRadius: 17,
    padding: 16,
    marginBottom: 12,
  },
  progressHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 11,
  },
  progressTitle: {
    color: '#5A3B68',
    fontSize: 13,
    fontWeight: '800',
  },
  progressCount: {
    color: '#6D6174',
    fontSize: 12,
    fontWeight: '700',
  },
  progressTrack: {
    height: 8,
    borderRadius: 5,
    backgroundColor: '#E3D9E0',
    overflow: 'hidden',
  },
  progressFill: {
    height: '100%',
    borderRadius: 5,
    backgroundColor: '#8C9E83',
  },
  progressMessage: {
    color: '#706676',
    fontSize: 11,
    lineHeight: 16,
    marginTop: 10,
  },

  // Checklist
  checklistCard: {
    backgroundColor: '#F5EFF0',
    borderRadius: 18,
    paddingHorizontal: 15,
    paddingVertical: 3,
  },
  checklistRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    paddingVertical: 16,
  },
  checkbox: {
    width: 23,
    height: 23,
    borderWidth: 1.5,
    borderColor: '#A7A0AE',
    borderRadius: 7,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12,
    marginTop: 1,
  },
  checkboxCompleted: {
    backgroundColor: '#81967B',
    borderColor: '#81967B',
  },
  checkmark: {
    color: '#FFFFFF',
    fontSize: 15,
    fontWeight: '800',
  },
  checklistTextContainer: {
    flex: 1,
  },
  checklistTitle: {
    color: '#5A3B68',
    fontSize: 13,
    fontWeight: '800',
  },
  completedText: {
    color: '#81967B',
  },
  checklistDescription: {
    color: '#706676',
    fontSize: 11,
    lineHeight: 16,
    marginTop: 4,
  },
  divider: {
    height: 1,
    backgroundColor: '#E2D8DE',
  },
  resetButton: {
    alignSelf: 'flex-end',
    paddingVertical: 10,
    paddingHorizontal: 4,
    marginBottom: 17,
    marginTop: 2,
  },
  resetButtonText: {
    color: '#5A3B68',
    fontSize: 11,
    fontWeight: '700',
    textDecorationLine: 'underline',
  },

  // Breathing exercise
  breathingCard: {
    backgroundColor: '#C9D6C2',
    borderRadius: 19,
    padding: 15,
    marginTop: 21,
    marginBottom: 28,
    flexDirection: 'row',
    alignItems: 'center',
  },
  breathingIconCircle: {
    width: 42,
    height: 42,
    borderRadius: 21,
    backgroundColor: '#F5EFF0',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 11,
  },
  breathingIcon: {
    color: '#5A3B68',
    fontSize: 24,
  },
  breathingTextContainer: {
    flex: 1,
    paddingRight: 7,
  },
  breathingTitle: {
    color: '#5A3B68',
    fontSize: 12,
    fontWeight: '800',
  },
  breathingDescription: {
    color: '#625C68',
    fontSize: 10,
    lineHeight: 15,
    marginTop: 4,
  },
  breathingButton: {
    backgroundColor: '#5A3B68',
    paddingHorizontal: 13,
    paddingVertical: 9,
    borderRadius: 12,
  },
  breathingButtonText: {
    color: '#FFFFFF',
    fontSize: 11,
    fontWeight: '700',
  },

  // Tips
  tipsCard: {
    backgroundColor: '#F5EFF0',
    borderRadius: 18,
    paddingHorizontal: 15,
    paddingVertical: 3,
  },
  tipRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    paddingVertical: 15,
  },
  tipBullet: {
    width: 27,
    height: 27,
    borderRadius: 14,
    backgroundColor: '#E5D9E8',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 11,
  },
  tipBulletText: {
    color: '#5A3B68',
    fontSize: 12,
    fontWeight: '800',
  },
  tipTextContainer: {
    flex: 1,
  },
  tipTitle: {
    color: '#5A3B68',
    fontSize: 12,
    fontWeight: '800',
  },
  tipDescription: {
    color: '#706676',
    fontSize: 11,
    lineHeight: 17,
    marginTop: 4,
  },

  // Closing note
  closingCard: {
    backgroundColor: '#E8E0E2',
    borderRadius: 17,
    padding: 16,
    marginTop: 24,
  },
  closingTitle: {
    color: '#5A3B68',
    fontSize: 13,
    fontWeight: '800',
  },
  closingDescription: {
    color: '#706676',
    fontSize: 11,
    lineHeight: 17,
    marginTop: 6,
  },
  bottomSpace: {
    height: 20,
  },
});