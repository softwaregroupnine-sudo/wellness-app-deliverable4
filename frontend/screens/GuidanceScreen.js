import React, { useCallback, useRef, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  ActivityIndicator,
} from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { getGuidanceRecommendations } from '../services/api';

// Activities grouped by their purpose.
// Each route must match a screen registered in App.js.
const ACTIVITY_SECTIONS = [
  {
    title: 'Calm and Relax',
    subtitle: 'Take a break and give yourself time to reset.',
    activities: [
      {
        title: 'Breathing Exercise',
        subtitle: 'Slow down and practise calming your breathing.',
        duration: '5 min',
        icon: '◉',
        route: 'BreathingExercise',
        color: '#C8B7D5',
      },
      {
        title: 'Sleep Better',
        subtitle: 'Explore a relaxing activity before bedtime.',
        duration: 'Anytime',
        icon: '☾',
        action: 'sleep',
        color: '#C7D8E6',
      },
    ],
  },
  {
    title: 'Move and Energise',
    subtitle: 'Gentle movement to lift your energy and ease stress.',
    activities: [
      {
        title: 'Move Your Body',
        subtitle: 'Short, no-equipment routines to match your energy.',
        duration: '2-10 min',
        icon: '↗',
        route: 'MoveBody',
        color: '#F0D9C2',
      },
    ],
  },
  {
    title: 'Study and Focus',
    subtitle: 'Make your workload feel more manageable.',
    activities: [
      {
        title: 'Focus Timer',
        subtitle: 'Concentrate on one task at a time.',
        duration: '20 min',
        icon: '◷',
        route: 'FocusTimer',
        color: '#DCD0E8',
      },
    ],
  },
  {
    title: 'Reflection and Journaling',
    subtitle: 'Make time to reflect on your experiences.',
    activities: [
      {
        title: 'Gratitude Journal',
        subtitle: 'Record your thoughts and reflect on your day.',
        duration: '5 min',
        icon: '✎',
        route: 'GratitudeJournal',
        color: '#E8DDAE',
      },
    ],
  },
  {
    title: 'Connection and Support',
    subtitle: 'Take time to work through what is on your mind.',
    activities: [
      {
        title: 'Talk Things Through',
        subtitle: 'Use the AI chat to reflect on your concerns.',
        duration: 'Anytime',
        icon: '♡',
        route: 'AIChat',
        color: '#E7C8D0',
      },
    ],
  },
];

export default function GuidanceScreen({ navigation, route }) {
  const insets = useSafeAreaInsets();

  // Preserve the logged-in user's information from navigation.
  const user = route?.params?.user || {};
  const participantId = user.participant_id;

  const [recommendations, setRecommendations] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const recommendationsRef = useRef(null);
  const requestIdRef = useRef(0);

  // Load personalised guidance from the backend.
  const loadRecommendations = useCallback(async () => {
    if (!participantId) {
      setError(
        'Your account information could not be found. Please log in again.'
      );
      setLoading(false);
      return;
    }

    const requestId = ++requestIdRef.current;

    if (!recommendationsRef.current) {
      setLoading(true);
    }

    setError('');

    try {
      const data = await getGuidanceRecommendations(participantId);

      if (requestId === requestIdRef.current) {
        recommendationsRef.current = data;
        setRecommendations(data);
      }
    } catch (err) {
      if (requestId === requestIdRef.current) {
        setError(
          err.message ||
            'Could not refresh your guidance. Please try again.'
        );
      }
    } finally {
      if (requestId === requestIdRef.current) {
        setLoading(false);
      }
    }
  }, [participantId]);

  // Refresh guidance whenever the screen becomes active.
  useFocusEffect(
    useCallback(() => {
      let isActive = true;
      const requestId = ++requestIdRef.current;

      async function refreshOnFocus() {
        if (!participantId) {
          setError(
            'Your account information could not be found. Please log in again.'
          );
          setLoading(false);
          return;
        }

        if (!recommendationsRef.current) {
          setLoading(true);
        }

        setError('');

        try {
          const data = await getGuidanceRecommendations(participantId);

          if (isActive && requestId === requestIdRef.current) {
            recommendationsRef.current = data;
            setRecommendations(data);
          }
        } catch (err) {
          if (isActive && requestId === requestIdRef.current) {
            setError(
              err.message ||
                'Could not refresh your guidance. Please try again.'
            );
          }
        } finally {
          if (isActive && requestId === requestIdRef.current) {
            setLoading(false);
          }
        }
      }

      refreshOnFocus();

      return () => {
        isActive = false;
      };
    }, [participantId])
  );

  // Open the selected activity and preserve the logged-in user.
  function openActivity(activity) {
    if (activity.action === 'sleep') {
      navigation.navigate('SleepBetter', { user });
      return;
    }

    if (activity.route) {
      navigation.navigate(activity.route, { user });
    }
  }

  const hasPersonalisedGuidance = Boolean(
    recommendations?.has_checkin || recommendations?.has_assessment
  );

  return (
    <View style={styles.container}>
      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={[
          styles.scrollContent,
          { paddingTop: insets.top + 12 },
        ]}
      >
        {/* Screen heading */}
        <View style={styles.header}>
          <Text style={styles.leafIcon}>🍃</Text>
          <Text style={styles.headerTitle}>Guidance</Text>
        </View>

        {/* Personalised guidance banner */}
        <View style={styles.guidanceCard}>
          <Text
            pointerEvents="none"
            style={styles.guidanceBranch}
            accessibilityElementsHidden
            importantForAccessibility="no"
          >
            🌿
          </Text>

          <View style={styles.guidanceContent}>
            <View style={styles.guidanceTopRow}>
              <View style={styles.leafCircle}>
                <Text style={styles.smallLeaf}>🍃</Text>
              </View>

              <Text style={styles.guidanceLabel}>
                Today's{'\n'}Guidance
              </Text>
            </View>

            {loading && !recommendations ? (
              <View style={styles.statusContainer}>
                <ActivityIndicator color="#5A3B68" size="small" />
                <Text style={styles.statusText}>
                  Finding guidance for you...
                </Text>
              </View>
            ) : error && !recommendations ? (
              <View>
                <Text style={styles.guidanceTitle}>
                  Your guidance is temporarily unavailable.
                </Text>

                <Text style={styles.guidanceText}>{error}</Text>

                <TouchableOpacity
                  style={styles.retryButton}
                  onPress={loadRecommendations}
                  activeOpacity={0.8}
                  accessibilityRole="button"
                  accessibilityLabel="Try loading guidance again"
                >
                  <Text style={styles.retryText}>Try again</Text>
                </TouchableOpacity>
              </View>
            ) : recommendations && hasPersonalisedGuidance ? (
              <>
                <Text style={styles.guidanceTitle}>
                  {recommendations.title ||
                    'Take things one step at a time.'}
                </Text>

                <Text style={styles.guidanceText}>
                  {recommendations.message ||
                    'Choose an activity that feels helpful for you today.'}
                </Text>

                {error ? (
                  <Text style={styles.refreshNotice}>
                    Showing your last loaded guidance. Refresh failed.
                  </Text>
                ) : null}
              </>
            ) : (
              <>
                <Text style={styles.guidanceTitle}>
                  Start with a moment for yourself.
                </Text>

                <Text style={styles.guidanceText}>
                  Complete a mood check-in or AI assessment to receive
                  guidance based on your responses. You can explore
                  the activities below in the meantime.
                </Text>

                {error ? (
                  <Text style={styles.refreshNotice}>
                    Your latest guidance could not be refreshed.
                  </Text>
                ) : null}
              </>
            )}
          </View>

          <Text pointerEvents="none" style={styles.heart}>♡</Text>
        </View>

        {/* Activity library */}
        <View style={styles.libraryHeading}>
          <Text style={styles.libraryTitle}>Explore activities</Text>
          <Text style={styles.librarySubtitle}>
            Choose what feels helpful for you today.
          </Text>
        </View>

        {ACTIVITY_SECTIONS.map((section) => (
          <View key={section.title} style={styles.section}>
            <View style={styles.sectionHeading}>
              <Text style={styles.sectionTitle}>{section.title}</Text>
              <Text style={styles.sectionSubtitle}>
                {section.subtitle}
              </Text>
            </View>

            <View style={styles.activityCard}>
              {section.activities.map((activity, index) => (
                <React.Fragment key={activity.title}>
                  {index > 0 ? <View style={styles.divider} /> : null}

                  <TouchableOpacity
                    style={styles.activityRow}
                    onPress={() => openActivity(activity)}
                    activeOpacity={0.75}
                    accessibilityRole="button"
                    accessibilityLabel={`${activity.title}. ${activity.subtitle}`}
                  >
                    <View
                      style={[
                        styles.thumbnail,
                        { backgroundColor: activity.color },
                      ]}
                    >
                      <Text style={styles.activityIcon}>
                        {activity.icon}
                      </Text>
                    </View>

                    <View style={styles.activityTextContainer}>
                      <Text style={styles.activityTitle}>
                        {activity.title}
                      </Text>

                      <Text style={styles.activitySubtitle}>
                        {activity.subtitle}
                      </Text>

                      <Text style={styles.durationText}>
                        {activity.duration}
                      </Text>
                    </View>

                    <Text style={styles.chevron}>›</Text>
                  </TouchableOpacity>
                </React.Fragment>
              ))}
            </View>
          </View>
        ))}

        {/* Wellbeing support note */}
        <View style={styles.supportNote}>
          <Text style={styles.supportTitle}>
            Remember, support is available.
          </Text>

          <Text style={styles.supportText}>
            These activities can support everyday wellbeing, but they
            are not a replacement for professional help. If you are
            struggling, consider speaking to someone you trust or a
            qualified support professional.
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
    paddingBottom: 30,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 24,
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

  // Today's Guidance banner
  guidanceCard: {
    minHeight: 195,
    backgroundColor: '#AEBBA5',
    borderRadius: 23,
    paddingHorizontal: 20,
    paddingTop: 17,
    paddingBottom: 20,
    position: 'relative',
    overflow: 'hidden',
  },
  guidanceContent: {
    position: 'relative',
    zIndex: 1,
  },
  guidanceTopRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  leafCircle: {
    width: 42,
    height: 42,
    borderRadius: 21,
    backgroundColor: '#F8F5F4',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 10,
  },
  smallLeaf: {
    fontSize: 20,
  },
  guidanceLabel: {
    color: '#5A3B68',
    fontSize: 14,
    fontWeight: '700',
    lineHeight: 17,
  },
  guidanceTitle: {
    color: '#5A3B68',
    fontSize: 21,
    lineHeight: 26,
    fontWeight: '800',
    marginTop: 13,
    paddingRight: 38,
  },
  guidanceText: {
    color: '#685D70',
    fontSize: 12,
    lineHeight: 18,
    marginTop: 10,
    paddingRight: 15,
  },
  heart: {
    position: 'absolute',
    right: 25,
    top: 56,
    color: '#5A3B68',
    fontSize: 34,
    fontWeight: '300',
    opacity: 0.65,
    zIndex: 0,
  },
  guidanceBranch: {
    position: 'absolute',
    right: 5,
    bottom: 0,
    fontSize: 58,
    opacity: 0.28,
    transform: [{ rotate: '-15deg' }],
    zIndex: 0,
  },
  statusContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 22,
    marginBottom: 15,
  },
  statusText: {
    color: '#685D70',
    fontSize: 12,
    lineHeight: 18,
    marginLeft: 10,
    flexShrink: 1,
  },
  retryButton: {
    alignSelf: 'flex-start',
    backgroundColor: '#F6EFF3',
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 12,
    marginTop: 12,
  },
  retryText: {
    color: '#5A3B68',
    fontSize: 11,
    fontWeight: '700',
  },
  refreshNotice: {
    color: '#685D70',
    fontSize: 10,
    lineHeight: 15,
    marginTop: 8,
  },

  // Activity library
  libraryHeading: {
    marginTop: 38,
    marginBottom: 8,
  },
  libraryTitle: {
    color: '#5A3B68',
    fontSize: 19,
    fontWeight: '800',
  },
  librarySubtitle: {
    color: '#706676',
    fontSize: 12,
    lineHeight: 18,
    marginTop: 5,
  },
  section: {
    marginTop: 19,
  },
  sectionHeading: {
    marginBottom: 9,
  },
  sectionTitle: {
    color: '#5A3B68',
    fontSize: 15,
    fontWeight: '800',
  },
  sectionSubtitle: {
    color: '#706676',
    fontSize: 11,
    lineHeight: 16,
    marginTop: 4,
  },
  activityCard: {
    backgroundColor: '#F5EFF0',
    borderRadius: 18,
    paddingHorizontal: 12,
    paddingVertical: 3,
  },
  activityRow: {
    minHeight: 91,
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 12,
  },
  thumbnail: {
    width: 51,
    height: 55,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12,
  },
  activityIcon: {
    color: '#5A3B68',
    fontSize: 25,
  },
  activityTextContainer: {
    flex: 1,
    paddingRight: 5,
  },
  activityTitle: {
    color: '#5A3B68',
    fontSize: 13,
    lineHeight: 18,
    fontWeight: '800',
  },
  activitySubtitle: {
    color: '#706676',
    fontSize: 11,
    lineHeight: 15,
    marginTop: 3,
  },
  durationText: {
    color: '#6A5870',
    fontSize: 10,
    fontWeight: '700',
    marginTop: 5,
  },
  chevron: {
    color: '#6A5870',
    fontSize: 27,
    marginLeft: 7,
  },
  divider: {
    height: 1,
    backgroundColor: '#E0D6DC',
    marginHorizontal: 2,
  },

  // Wellbeing support note
  supportNote: {
    backgroundColor: '#E8E0E2',
    borderRadius: 16,
    padding: 15,
    marginTop: 25,
  },
  supportTitle: {
    color: '#5A3B68',
    fontSize: 13,
    fontWeight: '800',
    marginBottom: 6,
  },
  supportText: {
    color: '#706676',
    fontSize: 11,
    lineHeight: 17,
  },
  bottomSpace: {
    height: 30,
  },
});