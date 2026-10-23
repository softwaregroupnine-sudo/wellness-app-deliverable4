import React, { useCallback, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
} from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import {
  getMoodCheckins,
  getSavedWellnessRecommendations,
  generateWellnessAnalysis,
} from '../services/api';
import { getQuoteOfTheDay } from '../utils/quoteUtils';

const MOOD_OPTIONS = [
  {
    label: 'Awful',
    value: 'awful',
    emoji: '😞',
    color: '#F4D9D9',
  },
  {
    label: 'Not Great',
    value: 'not great',
    emoji: '😕',
    color: '#F3E1D0',
  },
  {
    label: 'Okay',
    value: 'okay',
    emoji: '😐',
    color: '#F3EBCB',
  },
  {
    label: 'Good',
    value: 'good',
    emoji: '🙂',
    color: '#DCEBD9',
  },
  {
    label: 'Amazing',
    value: 'amazing',
    emoji: '😄',
    color: '#CDE6D8',
  },
];

const ACTIVITY_ROUTES = {
  breathing: 'BreathingExercise',
  focus_timer: 'FocusTimer',
  gratitude_journal: 'GratitudeJournal',
  sleep: 'SleepBetter',
  talk_to_someone: 'AIChat',
  movement: 'MoveBody',
};

const ACTIVITY_CONFIG = {
  breathing: {
    icon: 'leaf-outline',
    iconColor: '#466B58',
    backgroundColor: '#E1EDE2',
  },
  focus_timer: {
    icon: 'timer-outline',
    iconColor: '#79688F',
    backgroundColor: '#E7E1F0',
  },
  gratitude_journal: {
    icon: 'book-outline',
    iconColor: '#466B58',
    backgroundColor: '#E1EDE2',
  },
  sleep: {
    icon: 'moon-outline',
    iconColor: '#587A9B',
    backgroundColor: '#DDE8F3',
  },
  talk_to_someone: {
    icon: 'chatbubble-ellipses-outline',
    iconColor: '#79688F',
    backgroundColor: '#E7E1F0',
  },
  movement: {
    icon: 'walk-outline',
    iconColor: '#A56A3A',
    backgroundColor: '#F5E6D6',
  },
};

function getGreeting() {
  const hour = new Date().getHours();

  if (hour < 12) return 'Good morning';
  if (hour < 17) return 'Good afternoon';

  return 'Good evening';
}

function getCheckinsFromResponse(response) {
  if (Array.isArray(response)) return response;
  if (Array.isArray(response?.checkins)) return response.checkins;
  if (Array.isArray(response?.mood_checkins)) return response.mood_checkins;
  if (Array.isArray(response?.data)) return response.data;

  return null;
}

function getLocalDateString(date = new Date()) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');

  return `${year}-${month}-${day}`;
}

function getCheckinDateString(checkin) {
  if (
    typeof checkin?.checkin_date === 'string' &&
    checkin.checkin_date.trim() !== ''
  ) {
    return checkin.checkin_date.slice(0, 10);
  }

  const value = checkin?.created_at || checkin?.date;

  if (!value) return '';

  const date = new Date(value);

  if (Number.isNaN(date.getTime())) return '';

  return getLocalDateString(date);
}

function getCheckinTimestamp(checkin) {
  const value =
    checkin?.checkin_date ||
    checkin?.created_at ||
    checkin?.date;

  if (!value) return 0;

  const timestamp = new Date(value).getTime();

  return Number.isNaN(timestamp) ? 0 : timestamp;
}

function getCheckinFeelings(value) {
  if (Array.isArray(value)) return value;

  if (typeof value === 'string') {
    try {
      const parsed = JSON.parse(value);
      return Array.isArray(parsed) ? parsed : [];
    } catch {
      return [];
    }
  }

  return [];
}

function getCheckinStreak(checkins, today = new Date()) {
  const checkinDates = new Set(
    checkins
      .map((checkin) => getCheckinDateString(checkin))
      .filter((date) => /^\d{4}-\d{2}-\d{2}$/.test(date))
  );

  const todayString = getLocalDateString(today);

  const yesterday = new Date(today);
  yesterday.setDate(yesterday.getDate() - 1);

  const yesterdayString = getLocalDateString(yesterday);

  let currentDate;

  if (checkinDates.has(todayString)) {
    currentDate = todayString;
  } else if (checkinDates.has(yesterdayString)) {
    currentDate = yesterdayString;
  } else {
    return 0;
  }

  let streak = 0;

  while (checkinDates.has(currentDate)) {
    streak++;

    const [year, month, day] = currentDate
      .split('-')
      .map(Number);

    const previousDate = new Date(
      Date.UTC(year, month - 1, day - 1)
    );

    currentDate = [
      previousDate.getUTCFullYear(),
      String(previousDate.getUTCMonth() + 1).padStart(2, '0'),
      String(previousDate.getUTCDate()).padStart(2, '0'),
    ].join('-');
  }

  return streak;
}

function getActivityKey(recommendation) {
  return String(recommendation?.activity || '')
    .trim()
    .toLowerCase();
}

function getPersonalisedActivities(response) {
  const recommendations =
    response?.analysis?.recommendations ||
    response?.recommendations ||
    response?.data?.analysis?.recommendations ||
    [];

  if (!Array.isArray(recommendations)) {
    return [];
  }

  const seenActivities = new Set();

  // Keep usable, non-duplicate activities that have a screen to open.
  const validRecommendations = recommendations.filter(
    (recommendation) => {
      const activity = getActivityKey(recommendation);

      if (
        !activity ||
        activity === 'none' ||
        !ACTIVITY_ROUTES[activity] ||
        seenActivities.has(activity)
      ) {
        return false;
      }

      seenActivities.add(activity);
      return true;
    }
  );

  // The Gratitude Journal already has its own card further down the
  // Dashboard, so it is listed last and only fills a free slot. This
  // way the AI's other suggestions always come first, but the list
  // still shows two activities when the journal is one of them.
  const otherActivities = validRecommendations.filter(
    (recommendation) =>
      getActivityKey(recommendation) !== 'gratitude_journal'
  );

  const journalActivities = validRecommendations.filter(
    (recommendation) =>
      getActivityKey(recommendation) === 'gratitude_journal'
  );

  return [...otherActivities, ...journalActivities].slice(0, 2);
}

export default function DashboardScreen({ navigation, route }) {
  const insets = useSafeAreaInsets();

  const user = route?.params?.user || {};

  const studentName =
    user.display_name ||
    user.name ||
    user.full_name ||
    user.username ||
    'Student';

  const accountKey =
    user.participant_id ||
    user.email ||
    'guest';

  const [quoteResult, setQuoteResult] = useState(null);
  const [hasCheckins, setHasCheckins] = useState(false);
  const [quoteLoading, setQuoteLoading] = useState(true);
  const [quoteError, setQuoteError] = useState('');

  const [hasCheckedInToday, setHasCheckedInToday] = useState(false);
  const [checkinHistoryLoading, setCheckinHistoryLoading] = useState(true);
  const [checkinHistoryError, setCheckinHistoryError] = useState('');

  const [streakCount, setStreakCount] = useState(null);

  // Personalised AI-recommended Dashboard activities.
  const [personalisedActivities, setPersonalisedActivities] = useState([]);
  const [activitiesLoading, setActivitiesLoading] = useState(true);
  const [activitiesError, setActivitiesError] = useState('');
  const [activityRetryCount, setActivityRetryCount] = useState(0);

  useFocusEffect(
    useCallback(() => {
      let isActive = true;

      async function loadDashboard() {
        setQuoteLoading(true);
        setQuoteError('');

        setCheckinHistoryLoading(true);
        setCheckinHistoryError('');
        setStreakCount(null);

        setActivitiesLoading(true);
        setActivitiesError('');
        setPersonalisedActivities([]);

        try {
          const participantId = user.participant_id;

          if (!participantId) {
            if (isActive) {
              setHasCheckins(false);
              setHasCheckedInToday(false);
              setStreakCount(null);

              setCheckinHistoryError(
                'We could not verify your check-in status. Please sign in again.'
              );

              setActivitiesError(
                'Please sign in again to load your recommended activities.'
              );
            }

            return;
          }

          // 1. Load check-ins FIRST.
          // New users should not trigger AI analysis before their first check-in.
          const response = await getMoodCheckins(participantId);
          const checkins = getCheckinsFromResponse(response);

          if (checkins === null) {
            throw new Error(
              'The check-in history returned an unexpected format.'
            );
          }

          const validCheckins = checkins.filter(
            (checkin) =>
              checkin &&
              typeof checkin.mood_value === 'string' &&
              checkin.mood_value.trim() !== ''
          );

          const today = getLocalDateString();

          const checkedInToday = validCheckins.some(
            (checkin) => getCheckinDateString(checkin) === today
          );

          if (isActive) {
            setHasCheckins(validCheckins.length > 0);
            setHasCheckedInToday(checkedInToday);
            setStreakCount(getCheckinStreak(validCheckins));
          }

          // 2. No check-ins: do not generate an AI analysis.
          // Show the first-check-in prompt in the recommendations section.
          if (validCheckins.length === 0) {
            if (isActive) {
              setQuoteResult(null);
              setPersonalisedActivities([]);
              setActivitiesError('');
            }

            return;
          }

          // 3. Load the quote based on the latest check-in.
          const sortedCheckins = [...validCheckins].sort(
            (first, second) =>
              getCheckinTimestamp(second) -
              getCheckinTimestamp(first)
          );

          const latestCheckin = sortedCheckins[0];

          const feelings = getCheckinFeelings(
            latestCheckin.feelings
          );

          const result = getQuoteOfTheDay({
            mood: latestCheckin.mood_value,
            feelings,
            userId: participantId,
          });

          if (isActive) {
            setQuoteResult(result);
          }

          // 4. Load recommendations already saved in the database.
          // Avoid generating another analysis if recommendations exist.
          try {
            const savedResponse =
              await getSavedWellnessRecommendations(participantId);

            const savedActivities =
              getPersonalisedActivities(savedResponse);

            if (savedActivities.length > 0) {
              if (isActive) {
                setPersonalisedActivities(savedActivities);
                setActivitiesError('');
              }

              return;
            }

            // 5. Check-ins exist, but there are no saved recommendations.
            // Generate an analysis only when necessary.
            const analysisResponse =
              await generateWellnessAnalysis(participantId);

            const generatedActivities =
              getPersonalisedActivities(analysisResponse);

            if (isActive) {
              setPersonalisedActivities(generatedActivities);

              if (generatedActivities.length > 0) {
                setActivitiesError('');
              } else {
                setActivitiesError(
                  'We could not prepare your recommendations just yet. Please try again.'
                );
              }
            }
          } catch (error) {
            // Keep technical details in the development console.
            console.error(
              'Could not load personalised dashboard activities:',
              error
            );

            if (isActive) {
              setPersonalisedActivities([]);

              setActivitiesError(
                'Your recommended activities are temporarily unavailable. Please try again.'
              );
            }
          }
        } catch (error) {
          console.error(
            'Could not load dashboard check-in history:',
            error
          );

          if (isActive) {
            setQuoteResult(null);
            setQuoteError(
              'Your quote could not be loaded right now. Please try again later.'
            );

            setCheckinHistoryError(
              'We could not verify your check-in status. Please try again.'
            );

            setStreakCount(null);

            setActivitiesError(
              'We could not check your wellness history. Please try again.'
            );
          }
        } finally {
          if (isActive) {
            setQuoteLoading(false);
            setCheckinHistoryLoading(false);
            setActivitiesLoading(false);
          }
        }
      }

      loadDashboard();

      return () => {
        isActive = false;
      };
    }, [
      accountKey,
      user.participant_id,
      activityRetryCount,
    ])
  );

  function retryRecommendedActivities() {
    setActivitiesError('');
    setActivitiesLoading(true);
    setActivityRetryCount((count) => count + 1);
  }

  function openMoodCheckIn(mood) {
    if (
      checkinHistoryLoading ||
      checkinHistoryError ||
      hasCheckedInToday
    ) {
      return;
    }

    navigation.navigate('Check-in', {
      user,
      selectedMood: mood.label,
      moodLabel: mood.label,
      moodEmoji: mood.emoji,
    });
  }

  function openGeneralMoodCheckIn() {
    if (
      checkinHistoryLoading ||
      checkinHistoryError ||
      hasCheckedInToday
    ) {
      return;
    }

    navigation.navigate('Check-in', { user });
  }

  function openNotifications() {
    navigation.navigate('Notifications', { user });
  }

  function openGuidance() {
    navigation.navigate('Guidance', { user });
  }

  function openGratitudeJournal() {
    navigation.navigate('GratitudeJournal', { user });
  }

  function openWrittenAssessment() {
    navigation.navigate('WrittenAssessment', { user });
  }

  function openRecommendedActivity(activity) {
    const activityKey = String(activity || '')
      .trim()
      .toLowerCase();

    const routeName = ACTIVITY_ROUTES[activityKey];

    if (!routeName) return;

    navigation.navigate(routeName, { user });
  }

  function renderQuoteContent() {
    if (quoteLoading) {
      return (
        <View style={styles.quoteStatusContainer}>
          <Text style={styles.quoteStatus}>
            Finding a quote for you...
          </Text>
        </View>
      );
    }

    if (quoteError) {
      return (
        <View style={styles.quoteStatusContainer}>
          <Ionicons
            name="cloud-offline-outline"
            size={24}
            color="#7B8583"
          />
          <Text style={styles.quoteStatus}>
            {quoteError}
          </Text>
        </View>
      );
    }

    if (hasCheckins && quoteResult?.quote) {
      return (
        <View style={styles.quoteContent}>
          <Text style={styles.quoteText}>
            "{quoteResult.quote.text}"
          </Text>

          {!!quoteResult.quote.author && (
            <Text style={styles.quoteAuthor}>
              — {quoteResult.quote.author}
            </Text>
          )}
        </View>
      );
    }

    if (hasCheckins) {
      return (
        <View style={styles.quoteStatusContainer}>
          <Text style={styles.quoteStatus}>
            Your quote is not available right now.
          </Text>
        </View>
      );
    }

    return (
      <View style={styles.newStudentQuoteContent}>
        <Text style={styles.quoteStatus}>
          Complete your first Mood Check-In to receive
          a quote based on how you're feeling.
        </Text>

        <TouchableOpacity
          style={[
            styles.checkInQuoteButton,
            (
              checkinHistoryLoading ||
              checkinHistoryError ||
              hasCheckedInToday
            ) && styles.disabledButton,
          ]}
          onPress={openGeneralMoodCheckIn}
          disabled={
            checkinHistoryLoading ||
            !!checkinHistoryError ||
            hasCheckedInToday
          }
          activeOpacity={0.8}
          accessibilityRole="button"
          accessibilityLabel="Complete your first mood check-in"
        >
          <Text style={styles.checkInQuoteButtonText}>
            Check in now
          </Text>

          <Ionicons
            name="arrow-forward"
            size={17}
            color="#FFFFFF"
          />
        </TouchableOpacity>
      </View>
    );
  }

  const checkinControlsDisabled =
    checkinHistoryLoading ||
    !!checkinHistoryError ||
    hasCheckedInToday;

  return (
    <View style={styles.container}>
      <View
        pointerEvents="none"
        style={styles.backgroundBlob}
      />

      <View
        pointerEvents="none"
        style={[
          styles.backgroundLeaf,
          { top: insets.top + 45 },
        ]}
      >
        <Text style={styles.backgroundLeafEmoji}>🌿</Text>
      </View>

      <ScrollView
        contentContainerStyle={[
          styles.scrollContent,
          { paddingTop: insets.top + 12 },
        ]}
        showsVerticalScrollIndicator={false}
      >
        {/* Header */}
        <View style={styles.header}>
          <View style={styles.headerLeft}>
            <Text style={styles.leafIcon}>🍃</Text>

            <View>
              <Text style={styles.headerTitle}>
                Dashboard
              </Text>
              <Text style={styles.headerSubtitle}>
                Your personal wellbeing space
              </Text>
            </View>
          </View>

          <TouchableOpacity
            style={styles.notificationButton}
            onPress={openNotifications}
            activeOpacity={0.8}
            accessibilityRole="button"
            accessibilityLabel="Open notifications"
          >
            <Ionicons
              name="notifications-outline"
              size={23}
              color="#252B29"
            />
          </TouchableOpacity>
        </View>

        {/* Greeting and Daily Streak */}
        <View style={styles.greetingStreakRow}>
          <View style={styles.greetingSection}>
            <Text style={styles.greeting}>
              {getGreeting()},
            </Text>

            <Text
              style={styles.studentName}
              numberOfLines={1}
              adjustsFontSizeToFit
            >
              {studentName}
            </Text>

            <Text style={styles.greetingMessage}>
              Small steps today. Big dreams tomorrow.
            </Text>
          </View>

          <View style={styles.streakCard}>
            <Text style={styles.streakFlame}>🔥</Text>

            <View style={styles.streakTextContainer}>
              <Text style={styles.streakTitle}>
                Daily Streak
              </Text>

              <Text
                style={styles.streakCount}
                accessibilityLabel={
                  streakCount === null
                    ? 'Streak unavailable'
                    : `${streakCount} day streak`
                }
              >
                {streakCount === null ? '—' : streakCount}
              </Text>

              <Text style={styles.streakDays}>Days</Text>
            </View>
          </View>
        </View>

        {/* Mood Check-In */}
        <View style={styles.section}>
          <View style={styles.moodCheckInCard}>
            <View style={styles.sectionHeader}>
              <View>
                <Text style={styles.sectionTitle}>
                  Mood Check-In
                </Text>

                <Text style={styles.sectionSubtitle}>
                  How are you feeling today?
                </Text>
              </View>
            </View>

            <View style={styles.moodOptions}>
              {MOOD_OPTIONS.map((mood) => (
                <TouchableOpacity
                  key={mood.value}
                  style={[
                    styles.moodOption,
                    checkinControlsDisabled &&
                      styles.disabledMoodOption,
                  ]}
                  onPress={() => openMoodCheckIn(mood)}
                  disabled={checkinControlsDisabled}
                  activeOpacity={0.75}
                  accessibilityRole="button"
                  accessibilityState={{
                    disabled: checkinControlsDisabled,
                  }}
                  accessibilityLabel={`Feeling ${mood.label}`}
                >
                  <View
                    style={[
                      styles.moodEmojiContainer,
                      { backgroundColor: mood.color },
                    ]}
                  >
                    <Text style={styles.moodEmoji}>
                      {mood.emoji}
                    </Text>
                  </View>

                  <Text style={styles.moodLabel}>
                    {mood.label}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>

            {checkinHistoryLoading ? (
              <View style={styles.checkinStatusContainer}>
                <Text style={styles.checkinStatusText}>
                  Checking today's check-in...
                </Text>
              </View>
            ) : checkinHistoryError ? (
              <View style={styles.checkinErrorContainer}>
                <Ionicons
                  name="cloud-offline-outline"
                  size={20}
                  color="#986B43"
                />

                <Text style={styles.checkinErrorText}>
                  {checkinHistoryError}
                </Text>
              </View>
            ) : hasCheckedInToday ? (
              <View style={styles.checkinCompletedContainer}>
                <Ionicons
                  name="checkmark-circle"
                  size={22}
                  color="#466B58"
                />

                <View style={styles.checkinCompletedTextContainer}>
                  <Text style={styles.checkinCompletedTitle}>
                    You've checked in today!
                  </Text>

                  <Text style={styles.checkinCompletedMessage}>
                    Your next check-in will be available tomorrow.
                  </Text>
                </View>
              </View>
            ) : null}

            <TouchableOpacity
              style={[
                styles.fullCheckInButton,
                checkinControlsDisabled &&
                  styles.disabledButton,
              ]}
              onPress={openGeneralMoodCheckIn}
              disabled={checkinControlsDisabled}
              activeOpacity={0.8}
              accessibilityRole="button"
              accessibilityState={{
                disabled: checkinControlsDisabled,
              }}
              accessibilityLabel={
                hasCheckedInToday
                  ? "You've checked in today"
                  : 'Open mood check-in'
              }
            >
              <Text style={styles.fullCheckInButtonText}>
                {checkinHistoryLoading
                  ? 'Checking status...'
                  : checkinHistoryError
                    ? 'Check-in unavailable'
                    : hasCheckedInToday
                      ? "You've checked in today"
                      : 'Open Mood Check-In'}
              </Text>

              {!checkinControlsDisabled && (
                <Ionicons
                  name="arrow-forward"
                  size={17}
                  color="#FFFFFF"
                />
              )}
            </TouchableOpacity>
          </View>
        </View>

        {/* Quote of the Day */}
        <View style={styles.quoteCard}>
          <View style={styles.quoteHeader}>
            <View style={styles.quoteIconContainer}>
              <Ionicons
                name="sunny-outline"
                size={23}
                color="#7FA88A"
              />
            </View>

            <View style={styles.quoteHeadingText}>
              <Text style={styles.quoteTitle}>
                Quote of the Day
              </Text>

              <Text style={styles.quoteSubtitle}>
                A little reminder for you
              </Text>
            </View>
          </View>

          {renderQuoteContent()}
        </View>

        {/* Personalised Recommended Activities */}
        <View style={styles.section}>
          <View style={styles.sectionHeader}>
            <View>
              <Text style={styles.sectionTitle}>
                Recommended for You
              </Text>

              <Text style={styles.sectionSubtitle}>
                Small steps can make a difference.
              </Text>
            </View>
          </View>

          {activitiesLoading ? (
            <View style={styles.activityCard}>
              <View style={styles.activityTextContainer}>
                <Text style={styles.activityTitle}>
                  Finding your recommendations...
                </Text>

                <Text style={styles.activityDescription}>
                  Checking your saved recommendations first.
                </Text>
              </View>
            </View>
          ) : personalisedActivities.length > 0 ? (
            personalisedActivities.map((recommendation, index) => {
              const activityKey = String(
                recommendation.activity || ''
              )
                .trim()
                .toLowerCase();

              const config = ACTIVITY_CONFIG[activityKey];

              return (
                <TouchableOpacity
                  key={`${activityKey}-${index}`}
                  style={styles.activityCard}
                  onPress={() =>
                    openRecommendedActivity(activityKey)
                  }
                  activeOpacity={0.8}
                  accessibilityRole="button"
                  accessibilityLabel={`Open personalised activity: ${
                    recommendation.title ||
                    activityKey.replace(/_/g, ' ')
                  }`}
                >
                  <View
                    style={[
                      styles.activityIcon,
                      {
                        backgroundColor: config.backgroundColor,
                      },
                    ]}
                  >
                    <Ionicons
                      name={config.icon}
                      size={24}
                      color={config.iconColor}
                    />
                  </View>

                  <View style={styles.activityTextContainer}>
                    <Text style={styles.activityTitle}>
                      {recommendation.title ||
                        activityKey.replace(/_/g, ' ')}
                    </Text>

                    <Text style={styles.activityDescription}>
                      {recommendation.message ||
                        'Take a moment to focus on your wellbeing.'}
                    </Text>
                  </View>

                  <Ionicons
                    name="chevron-forward"
                    size={20}
                    color="#87918C"
                  />
                </TouchableOpacity>
              );
            })
          ) : checkinHistoryError ? (
            <View style={styles.activityCard}>
              <View style={styles.activityTextContainer}>
                <Text style={styles.activityTitle}>
                  Recommendations temporarily unavailable
                </Text>

                <Text style={styles.activityDescription}>
                  We need to verify your check-in history before
                  we can load personalised activities.
                </Text>

                <TouchableOpacity
                  style={styles.activityRetryButton}
                  onPress={retryRecommendedActivities}
                  activeOpacity={0.8}
                  accessibilityRole="button"
                  accessibilityLabel="Retry loading recommended activities"
                >
                  <Text style={styles.activityRetryButtonText}>
                    Try again
                  </Text>
                </TouchableOpacity>
              </View>
            </View>
          ) : !hasCheckins ? (
            <View style={styles.activityCard}>
              <View style={styles.activityTextContainer}>
                <Text style={styles.activityTitle}>
                  Let's personalise your wellness journey
                </Text>

                <Text style={styles.activityDescription}>
                  Complete your first mood check-in so we can
                  recommend activities that better match how
                  you're feeling.
                </Text>

                <TouchableOpacity
                  style={styles.activityRetryButton}
                  onPress={openGeneralMoodCheckIn}
                  disabled={checkinControlsDisabled}
                  activeOpacity={0.8}
                  accessibilityRole="button"
                  accessibilityLabel="Complete your first mood check-in"
                >
                  <Text style={styles.activityRetryButtonText}>
                    Complete mood check-in
                  </Text>
                </TouchableOpacity>
              </View>
            </View>
          ) : (
            <View style={styles.activityCard}>
              <View style={styles.activityTextContainer}>
                <Text style={styles.activityTitle}>
                  Your recommendations aren't ready yet
                </Text>

                <Text style={styles.activityDescription}>
                  We couldn't prepare your personalised activities
                  right now. You can try again.
                </Text>

                <TouchableOpacity
                  style={styles.activityRetryButton}
                  onPress={retryRecommendedActivities}
                  activeOpacity={0.8}
                  accessibilityRole="button"
                  accessibilityLabel="Retry generating recommended activities"
                >
                  <Text style={styles.activityRetryButtonText}>
                    Try again
                  </Text>
                </TouchableOpacity>
              </View>
            </View>
          )}

          {/* View all guidance link */}
          <TouchableOpacity
            style={styles.guidanceLink}
            onPress={openGuidance}
            activeOpacity={0.7}
            accessibilityRole="button"
            accessibilityLabel="View all guidance"
          >
            <Text style={styles.guidanceLinkText}>
              View all guidance
            </Text>

            <Ionicons
              name="arrow-forward"
              size={16}
              color="#466B58"
            />
          </TouchableOpacity>
        </View>

        {/* Journal */}
        <View style={styles.section}>
          <View style={styles.sectionHeader}>
            <View>
              <Text style={styles.sectionTitle}>
                Reflect & Write
              </Text>

              <Text style={styles.sectionSubtitle}>
                Reflect on the things that matter to you.
              </Text>
            </View>
          </View>

          <TouchableOpacity
            style={styles.journalCard}
            onPress={openGratitudeJournal}
            activeOpacity={0.8}
          >
            <View style={styles.journalIconContainer}>
              <Ionicons
                name="book-outline"
                size={25}
                color="#466B58"
              />
            </View>

            <View style={styles.activityTextContainer}>
              <Text style={styles.activityTitle}>
                Gratitude Journal
              </Text>

              <Text style={styles.activityDescription}>
                Write down something you appreciate today.
              </Text>
            </View>

            <Ionicons
              name="chevron-forward"
              size={20}
              color="#87918C"
            />
          </TouchableOpacity>

          <TouchableOpacity
            style={[styles.journalCard, styles.assessmentCard]}
            onPress={openWrittenAssessment}
            activeOpacity={0.8}
            accessibilityRole="button"
            accessibilityLabel="Open written assessment"
          >
            <View style={styles.journalIconContainer}>
              <Ionicons
                name="create-outline"
                size={25}
                color="#466B58"
              />
            </View>

            <View style={styles.activityTextContainer}>
              <Text style={styles.activityTitle}>
                Written Assessment
              </Text>

              <Text style={styles.activityDescription}>
                Describe how you feel in your own words and get guidance.
              </Text>
            </View>

            <Ionicons
              name="chevron-forward"
              size={20}
              color="#87918C"
            />
          </TouchableOpacity>
        </View>

        <Text style={styles.footerText}>
          Remember to be kind to yourself. Every small step counts.
        </Text>
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
    paddingHorizontal: 22,
    paddingBottom: 35,
  },

  backgroundBlob: {
    position: 'absolute',
    top: -80,
    right: -80,
    width: 300,
    height: 180,
    backgroundColor: '#D5E2D2',
    borderTopLeftRadius: 180,
    borderTopRightRadius: 80,
    borderBottomLeftRadius: 120,
    borderBottomRightRadius: 120,
  },

  backgroundLeaf: {
    position: 'absolute',
    right: -25,
    opacity: 0.12,
    zIndex: 0,
  },

  backgroundLeafEmoji: {
    fontSize: 100,
    color: '#718D73',
    transform: [{ rotate: '-25deg' }],
  },

  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 22,
    zIndex: 1,
  },

  headerLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },

  leafIcon: {
    fontSize: 25,
    marginRight: 7,
  },

  headerTitle: {
    fontSize: 24,
    fontWeight: '700',
    color: '#3F4B49',
  },

  headerSubtitle: {
    fontSize: 12,
    color: '#7B8583',
    marginTop: 4,
  },

  notificationButton: {
    width: 38,
    height: 42,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 0,
    backgroundColor: 'transparent',
    borderWidth: 0,
  },

  greetingStreakRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginTop: 0,
    marginBottom: 26,
    zIndex: 1,
  },

  greetingSection: {
    flex: 1,
    minWidth: 0,
    marginRight: 8,
  },

  greeting: {
    fontSize: 27,
    lineHeight: 35,
    fontWeight: '700',
    color: '#6B8F78',
  },

  studentName: {
    fontSize: 27,
    lineHeight: 35,
    fontWeight: '700',
    color: '#6B8F78',
  },

  greetingMessage: {
    fontSize: 12,
    lineHeight: 18,
    color: '#829B87',
    marginTop: 7,
  },

  streakCard: {
    width: '30%',
    minHeight: 72,
    borderRadius: 18,
    backgroundColor: 'rgba(196, 216, 198, 0.72)',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 6,
  },

  streakFlame: {
    fontSize: 22,
    marginRight: 5,
  },

  streakTextContainer: {
    alignItems: 'flex-start',
    justifyContent: 'center',
  },

  streakTitle: {
    fontSize: 9,
    fontWeight: '400',
    color: '#3F4B49',
    marginBottom: -2,
  },

  streakCount: {
    fontSize: 26,
    lineHeight: 29,
    fontWeight: '700',
    color: '#3F4B49',
  },

  streakDays: {
    fontSize: 9,
    color: '#3F4B49',
    marginTop: -2,
  },

  section: {
    marginBottom: 29,
    zIndex: 1,
  },

  sectionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 17,
  },

  sectionTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: '#304F4A',
  },

  sectionSubtitle: {
    fontSize: 12,
    lineHeight: 18,
    color: '#7B8583',
    marginTop: 4,
  },

  moodCheckInCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 21,
    padding: 19,
    borderWidth: 1,
    borderColor: '#ECEDE6',
  },

  moodOptions: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 17,
  },

  moodOption: {
    alignItems: 'center',
    flex: 1,
  },

  disabledMoodOption: {
    opacity: 0.8,
  },

  moodEmojiContainer: {
    width: 48,
    height: 48,
    borderRadius: 17,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 8,
  },

  moodEmoji: {
    fontSize: 24,
  },

  moodLabel: {
    fontSize: 10,
    color: '#52635D',
    textAlign: 'center',
  },

  fullCheckInButton: {
    backgroundColor: '#304F4A',
    borderRadius: 12,
    paddingVertical: 12,
    paddingHorizontal: 16,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 9,
  },

  fullCheckInButtonText: {
    fontSize: 14,
    fontWeight: '700',
    color: '#FFFFFF',
    textAlign: 'center',
  },

  disabledButton: {
    opacity: 0.65,
  },

  checkinStatusContainer: {
    backgroundColor: '#F7F8F2',
    borderRadius: 12,
    padding: 12,
    marginBottom: 14,
    alignItems: 'center',
  },

  checkinStatusText: {
    fontSize: 12,
    lineHeight: 18,
    color: '#718078',
    textAlign: 'center',
  },

  checkinCompletedContainer: {
    backgroundColor: '#F0F5EF',
    borderRadius: 12,
    padding: 13,
    marginBottom: 14,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },

  checkinCompletedTextContainer: {
    flex: 1,
  },

  checkinCompletedTitle: {
    fontSize: 13,
    fontWeight: '700',
    color: '#304F4A',
  },

  checkinCompletedMessage: {
    fontSize: 11,
    lineHeight: 17,
    color: '#718078',
    marginTop: 4,
  },

  checkinErrorContainer: {
    backgroundColor: '#FBF1E6',
    borderRadius: 12,
    padding: 12,
    marginBottom: 14,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 9,
  },

  checkinErrorText: {
    flex: 1,
    fontSize: 12,
    lineHeight: 18,
    color: '#805C3D',
  },

  quoteCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 21,
    padding: 19,
    marginBottom: 30,
    borderWidth: 1,
    borderColor: '#ECEDE6',
  },

  quoteHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 17,
  },

  quoteIconContainer: {
    width: 45,
    height: 45,
    borderRadius: 15,
    backgroundColor: '#E8F0E6',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },

  quoteHeadingText: {
    flex: 1,
  },

  quoteTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: '#304F4A',
  },

  quoteSubtitle: {
    fontSize: 11,
    color: '#7B8583',
    marginTop: 4,
  },

  quoteContent: {
    backgroundColor: '#F7F8F2',
    borderRadius: 15,
    padding: 16,
  },

  quoteText: {
    fontSize: 15,
    lineHeight: 24,
    fontStyle: 'italic',
    color: '#405B50',
  },

  quoteAuthor: {
    fontSize: 12,
    color: '#7B8583',
    textAlign: 'right',
    marginTop: 12,
  },

  quoteStatusContainer: {
    backgroundColor: '#F7F8F2',
    borderRadius: 15,
    padding: 16,
    alignItems: 'center',
    gap: 9,
  },

  quoteStatus: {
    fontSize: 12,
    lineHeight: 19,
    color: '#718078',
  },

  newStudentQuoteContent: {
    backgroundColor: '#F7F8F2',
    borderRadius: 15,
    padding: 16,
  },

  checkInQuoteButton: {
    backgroundColor: '#304F4A',
    borderRadius: 12,
    paddingHorizontal: 15,
    paddingVertical: 12,
    marginTop: 15,
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    gap: 9,
    alignSelf: 'flex-start',
  },

  checkInQuoteButtonText: {
    fontSize: 12,
    fontWeight: '700',
    color: '#FFFFFF',
  },

  activityCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 17,
    padding: 14,
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 11,
    borderWidth: 1,
    borderColor: '#ECEDE6',
  },

  activityIcon: {
    width: 47,
    height: 47,
    borderRadius: 15,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 13,
  },

  activityTextContainer: {
    flex: 1,
    paddingRight: 8,
  },

  activityTitle: {
    fontSize: 13,
    fontWeight: '700',
    color: '#304F4A',
  },

  activityDescription: {
    fontSize: 11,
    lineHeight: 16,
    color: '#7B8583',
    marginTop: 4,
  },

  activityRetryButton: {
    backgroundColor: '#304F4A',
    borderRadius: 10,
    paddingHorizontal: 13,
    paddingVertical: 9,
    marginTop: 12,
    alignSelf: 'flex-start',
  },

  activityRetryButtonText: {
    fontSize: 12,
    fontWeight: '700',
    color: '#FFFFFF',
  },

  guidanceLink: {
    flexDirection: 'row',
    alignItems: 'center',
    alignSelf: 'flex-end',
    gap: 6,
    paddingVertical: 8,
    marginTop: 1,
  },

  guidanceLinkText: {
    fontSize: 12,
    fontWeight: '600',
    color: '#466B58',
  },

  journalCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 17,
    padding: 15,
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#ECEDE6',
  },

  assessmentCard: {
    marginTop: 11,
  },

  journalIconContainer: {
    width: 47,
    height: 47,
    borderRadius: 15,
    backgroundColor: '#E1EDE2',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 13,
  },

  footerText: {
    fontSize: 11,
    lineHeight: 18,
    textAlign: 'center',
    color: '#8A948D',
    paddingHorizontal: 10,
    marginTop: 1,
  },
});