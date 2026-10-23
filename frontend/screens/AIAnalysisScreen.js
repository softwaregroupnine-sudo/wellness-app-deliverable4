import React, { useState, useEffect, useMemo } from 'react';

import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  ActivityIndicator,
  Alert,
  Dimensions,
} from 'react-native';

import Svg, {
  Path,
  Circle,
  Line,
  Text as SvgText,
} from 'react-native-svg';

import { useSafeAreaInsets } from 'react-native-safe-area-context';

import {
  getMoodCheckins,
  generateWellnessAnalysis,
} from '../services/api';

const SCREEN_WIDTH = Dimensions.get('window').width;

const CHART_HEIGHT = 190;
const CHART_PADDING_LEFT = 28;
const CHART_PADDING_RIGHT = 18;
const CHART_PADDING_TOP = 20;
const CHART_PADDING_BOTTOM = 30;

const PURPLE = '#4A2E6B';
const LIGHT_PURPLE = '#C9B8E8';
const MUTED_PURPLE = '#8B7896';
const BACKGROUND = '#DDD5D6';

const getMoodScore = (value) => {
  if (value === null || value === undefined) {
    return null;
  }

  const text = String(value).trim().toLowerCase();

  const moodScores = {
    awful: 20,
    terrible: 20,
    'not great': 40,
    bad: 40,
    low: 40,
    okay: 60,
    ok: 60,
    neutral: 60,
    average: 60,
    good: 80,
    amazing: 100,
    great: 100,
    happy: 100,
  };

  if (
    Object.prototype.hasOwnProperty.call(moodScores, text)
  ) {
    return moodScores[text];
  }

  const number = Number(text);

  if (!Number.isFinite(number)) {
    return null;
  }

  if (number >= 1 && number <= 5) {
    return number * 20;
  }

  if (number >= 0 && number <= 100) {
    return number;
  }

  return null;
};

const getCheckinDate = (checkin) => {
  const rawDate =
    checkin.checkin_date ||
    checkin.date ||
    checkin.created_at;

  if (!rawDate) {
    return null;
  }

  const dateString = String(rawDate);

  const dateOnly = dateString.match(
    /^(\d{4})-(\d{2})-(\d{2})$/
  );

  let date;

  if (dateOnly) {
    date = new Date(
      Number(dateOnly[1]),
      Number(dateOnly[2]) - 1,
      Number(dateOnly[3]),
      12,
      0,
      0
    );
  } else {
    date = new Date(rawDate);
  }

  if (Number.isNaN(date.getTime())) {
    return null;
  }

  return date;
};

const startOfDay = (date) => {
  const result = new Date(date);
  result.setHours(0, 0, 0, 0);
  return result;
};

const formatDateKey = (date) => {
  const year = date.getFullYear();

  const month = String(
    date.getMonth() + 1
  ).padStart(2, '0');

  const day = String(
    date.getDate()
  ).padStart(2, '0');

  return `${year}-${month}-${day}`;
};

const getFeelingList = (checkin) => {
  let feelings = checkin.feelings;

  if (typeof feelings === 'string') {
    try {
      feelings = JSON.parse(feelings);
    } catch {
      feelings = feelings
        .split(',')
        .map((feeling) => feeling.trim());
    }
  }

  if (!Array.isArray(feelings)) {
    return [];
  }

  return feelings.filter(
    (feeling) => typeof feeling === 'string'
  );
};

const getPeriodData = (checkins, period) => {
  const today = startOfDay(new Date());
  const daysToShow = period === 'Week' ? 7 : 30;

  const startDate = new Date(today);

  startDate.setDate(
    startDate.getDate() - (daysToShow - 1)
  );

  const validCheckins = checkins
    .map((checkin) => {
      const date = getCheckinDate(checkin);

      return {
        ...checkin,
        parsedDate: date,
        score: getMoodScore(checkin.mood_value),
      };
    })
    .filter((checkin) => {
      if (!checkin.parsedDate || checkin.score === null) {
        return false;
      }

      const date = startOfDay(checkin.parsedDate);

      return date >= startDate && date <= today;
    });

  const dailyGroups = {};

  validCheckins.forEach((checkin) => {
    const dateKey = formatDateKey(checkin.parsedDate);

    if (!dailyGroups[dateKey]) {
      dailyGroups[dateKey] = {
        total: 0,
        count: 0,
        feelings: [],
      };
    }

    dailyGroups[dateKey].total += checkin.score;
    dailyGroups[dateKey].count += 1;

    dailyGroups[dateKey].feelings.push(
      ...getFeelingList(checkin)
    );
  });

  const numberOfPoints = period === 'Week' ? 7 : 5;
  const points = [];

  if (period === 'Week') {
    for (let i = 0; i < 7; i += 1) {
      const date = new Date(startDate);

      date.setDate(startDate.getDate() + i);

      const dateKey = formatDateKey(date);
      const group = dailyGroups[dateKey];

      points.push({
        label: date.toLocaleDateString('en', {
          weekday: 'short',
        }),
        date,
        score:
          group && group.count > 0
            ? group.total / group.count
            : null,
        checkinCount: group ? group.count : 0,
        feelings: group ? group.feelings : [],
      });
    }
  } else {
    for (let i = 0; i < numberOfPoints; i += 1) {
      const bucketStart = new Date(startDate);

      bucketStart.setDate(
        startDate.getDate() + i * 6
      );

      const bucketEnd = new Date(bucketStart);

      bucketEnd.setDate(bucketStart.getDate() + 5);

      let total = 0;
      let count = 0;
      let bucketFeelings = [];

      Object.entries(dailyGroups).forEach(
        ([dateKey, group]) => {
          const date = new Date(`${dateKey}T12:00:00`);

          if (
            date >= bucketStart &&
            date < new Date(
              bucketEnd.getFullYear(),
              bucketEnd.getMonth(),
              bucketEnd.getDate() + 1
            )
          ) {
            total += group.total;
            count += group.count;

            bucketFeelings = [
              ...bucketFeelings,
              ...group.feelings,
            ];
          }
        }
      );

      points.push({
        label: bucketStart.toLocaleDateString('en', {
          day: 'numeric',
          month: 'short',
        }),
        date: bucketStart,
        score: count > 0 ? total / count : null,
        checkinCount: count,
        feelings: bucketFeelings,
      });
    }
  }

  const allScores = validCheckins.map(
    (checkin) => checkin.score
  );

  const average =
    allScores.length > 0
      ? allScores.reduce((sum, score) => sum + score, 0) /
        allScores.length
      : null;

  return {
    points,
    average,
    totalCheckins: validCheckins.length,
    validCheckins,
  };
};

const getMoodDescription = (score) => {
  if (score === null || score === undefined) {
    return 'No data yet';
  }

  if (score <= 20) return 'Awful';
  if (score <= 40) return 'Not Great';
  if (score <= 60) return 'Okay';
  if (score <= 80) return 'Good';

  return 'Amazing';
};

const getMoodEmoji = (score) => {
  if (score === null || score === undefined) {
    return '🌱';
  }

  if (score <= 20) return '😞';
  if (score <= 40) return '😕';
  if (score <= 60) return '😐';
  if (score <= 80) return '🙂';

  return '😄';
};

function MoodChart({ points }) {
  const chartWidth = Math.max(
    SCREEN_WIDTH - 76,
    250
  );

  const plotWidth =
    chartWidth -
    CHART_PADDING_LEFT -
    CHART_PADDING_RIGHT;

  const plotHeight =
    CHART_HEIGHT -
    CHART_PADDING_TOP -
    CHART_PADDING_BOTTOM;

  const xForIndex = (index) => {
    if (points.length <= 1) {
      return CHART_PADDING_LEFT + plotWidth / 2;
    }

    return (
      CHART_PADDING_LEFT +
      (index / (points.length - 1)) * plotWidth
    );
  };

  const yForScore = (score) => (
    CHART_PADDING_TOP +
    ((100 - score) / 100) * plotHeight
  );

  const plottedPoints = points
    .map((point, index) => {
      if (point.score === null) {
        return null;
      }

      return {
        ...point,
        x: xForIndex(index),
        y: yForScore(point.score),
        index,
      };
    })
    .filter(Boolean);

  let pathData = '';

  plottedPoints.forEach((point, index) => {
    pathData +=
      `${index === 0 ? 'M' : 'L'} ` +
      `${point.x} ${point.y} `;
  });

  return (
    <View style={styles.chartContainer}>
      <Svg
        width="100%"
        height={CHART_HEIGHT}
        viewBox={`0 0 ${chartWidth} ${CHART_HEIGHT}`}
      >
        {[0, 25, 50, 75, 100].map((value) => {
          const y = yForScore(value);

          return (
            <React.Fragment key={value}>
              <Line
                x1={CHART_PADDING_LEFT}
                y1={y}
                x2={chartWidth - CHART_PADDING_RIGHT}
                y2={y}
                stroke="#E6DDEB"
                strokeWidth={1}
                strokeDasharray="4 4"
              />

              <SvgText
                x={CHART_PADDING_LEFT - 7}
                y={y + 4}
                fontSize="9"
                fill="#8B7896"
                textAnchor="end"
              >
                {value}
              </SvgText>
            </React.Fragment>
          );
        })}

        {pathData !== '' && (
          <Path
            d={pathData}
            stroke={PURPLE}
            strokeWidth={3}
            strokeLinecap="round"
            strokeLinejoin="round"
            fill="none"
          />
        )}

        {plottedPoints.map((point) => (
          <React.Fragment key={point.index}>
            <Circle
              cx={point.x}
              cy={point.y}
              r={5}
              fill="#FFFFFF"
              stroke={PURPLE}
              strokeWidth={2.5}
            />

            <SvgText
              x={point.x}
              y={CHART_HEIGHT - 9}
              fontSize="9"
              fill="#65536D"
              textAnchor="middle"
            >
              {point.label}
            </SvgText>
          </React.Fragment>
        ))}
      </Svg>

      {plottedPoints.length === 0 && (
        <View style={styles.chartEmptyOverlay}>
          <Text style={styles.chartEmptyText}>
            Your mood chart will appear here once you
            save a check-in.
          </Text>
        </View>
      )}
    </View>
  );
}

export default function AIAnalysisScreen({
  navigation,
  route,
}) {
  const insets = useSafeAreaInsets();
  const user = route.params?.user;

  const participantId =
    user?.participant_id ??
    user?.participantId ??
    null;

  const [period, setPeriod] = useState('Week');
  const [checkins, setCheckins] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [loadError, setLoadError] = useState('');

  // Backend-generated AI analysis state
  const [aiAnalysis, setAiAnalysis] = useState(null);
  const [aiLoading, setAiLoading] = useState(true);
  const [aiError, setAiError] = useState('');
  const [aiRefreshing, setAiRefreshing] = useState(false);

  const loadCheckins = async (isRefresh = false) => {
    if (!participantId) {
      setCheckins([]);
      setLoading(false);
      setRefreshing(false);
      setLoadError(
        'Your account information is missing. Please log in again.'
      );
      return;
    }

    if (isRefresh) {
      setRefreshing(true);
    } else {
      setLoading(true);
    }

    setLoadError('');

    try {
      const result = await getMoodCheckins(participantId);

      const rows = Array.isArray(result)
        ? result
        : Array.isArray(result?.checkins)
          ? result.checkins
          : Array.isArray(result?.data)
            ? result.data
            : [];

      setCheckins(rows);
    } catch (error) {
      setLoadError(
        error.message ||
          'Could not load your mood check-ins.'
      );
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  // Request personalised analysis from the Flask backend
  const loadAIAnalysis = async (isRefresh = false) => {
    if (!participantId) {
      setAiAnalysis(null);
      setAiLoading(false);
      setAiRefreshing(false);
      setAiError(
        'Your account information is missing. Please log in again.'
      );
      return;
    }

    if (isRefresh) {
      setAiRefreshing(true);
    } else {
      setAiLoading(true);
    }

    setAiError('');

    try {
      const result = await generateWellnessAnalysis(
        participantId
      );

      if (!result?.analysis) {
        throw new Error(
          'The server did not return a wellness analysis.'
        );
      }

      setAiAnalysis(result.analysis);
    } catch (error) {
      setAiError(
        error.message ||
          'Could not generate your wellness analysis. Please try again.'
      );
    } finally {
      setAiLoading(false);
      setAiRefreshing(false);
    }
  };

  useEffect(() => {
    loadCheckins();
    loadAIAnalysis();
  }, [participantId]);

  const periodData = useMemo(
    () => getPeriodData(checkins, period),
    [checkins, period]
  );

  const { points, average, totalCheckins, validCheckins } =
    periodData;

  const insights = useMemo(() => {
    if (validCheckins.length === 0) {
      return [
        {
          emoji: '🌱',
          title: 'Your wellness journey starts here',
          description:
            'Save a mood check-in to begin discovering patterns in how you feel.',
        },
      ];
    }

    const sorted = [...validCheckins].sort(
      (a, b) =>
        getCheckinDate(a).getTime() -
        getCheckinDate(b).getTime()
    );

    const firstHalf = sorted.slice(
      0,
      Math.ceil(sorted.length / 2)
    );

    const secondHalf = sorted.slice(
      Math.ceil(sorted.length / 2)
    );

    const averageOf = (items) => {
      if (items.length === 0) return null;

      return (
        items.reduce(
          (sum, item) => sum + item.score,
          0
        ) / items.length
      );
    };

    const firstAverage = averageOf(firstHalf);
    const secondAverage = averageOf(secondHalf);

    const result = [];

    result.push({
      emoji: getMoodEmoji(average),
      title: `Your average mood is ${getMoodDescription(
        average
      )}`,
      description:
        `Based on ${validCheckins.length} saved ` +
        `check-in${validCheckins.length === 1 ? '' : 's'} ` +
        `during this ${period.toLowerCase()}.`,
    });

    if (
      firstAverage !== null &&
      secondAverage !== null &&
      firstHalf.length > 0 &&
      secondHalf.length > 0
    ) {
      const difference = secondAverage - firstAverage;

      if (difference >= 10) {
        result.push({
          emoji: '📈',
          title: 'Your mood has been improving',
          description:
            'Your more recent check-ins have been more positive. Keep noticing what helps you feel this way.',
        });
      } else if (difference <= -10) {
        result.push({
          emoji: '💜',
          title: 'Give yourself some extra care',
          description:
            'Your more recent check-ins have been lower. Consider what has changed and whether a small supportive activity could help.',
        });
      } else {
        result.push({
          emoji: '🌿',
          title: 'Your mood has been relatively steady',
          description:
            'Your earlier and more recent check-ins are similar. Continue checking in to understand your patterns over time.',
        });
      }
    }

    const feelingCounts = {};

    validCheckins.forEach((checkin) => {
      getFeelingList(checkin).forEach((feeling) => {
        const key = feeling.trim();

        if (key) {
          feelingCounts[key] =
            (feelingCounts[key] || 0) + 1;
        }
      });
    });

    const commonFeeling = Object.entries(
      feelingCounts
    ).sort((a, b) => b[1] - a[1])[0];

    if (commonFeeling) {
      result.push({
        emoji: '🪴',
        title: `You've often selected ${commonFeeling[0].toLowerCase()}`,
        description:
          'Notice which situations, routines, or activities may be connected to this feeling.',
      });
    }

    return result;
  }, [validCheckins, average, period]);

  const keyPatterns = useMemo(() => {
    const feelingCounts = {};

    validCheckins.forEach((checkin) => {
      getFeelingList(checkin).forEach((feeling) => {
        const key = feeling.trim();

        if (key) {
          feelingCounts[key] =
            (feelingCounts[key] || 0) + 1;
        }
      });
    });

    return Object.entries(feelingCounts)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 4);
  }, [validCheckins]);

  // NEW: Open the activity suggested by the AI analysis.
  const openRecommendedActivity = (activity) => {
    const activityRoutes = {
      breathing: 'BreathingExercise',
      focus_timer: 'FocusTimer',
      gratitude_journal: 'GratitudeJournal',
      sleep: 'SleepBetter',
      talk_to_someone: 'AIChat',
      movement: 'MoveBody',
    };

    const activityKey = String(activity || '')
      .trim()
      .toLowerCase();

    const routeName = activityRoutes[activityKey];

    if (!routeName) {
      Alert.alert(
        'Activity unavailable',
        'This suggested activity is not available yet.'
      );
      return;
    }

    navigation.navigate(routeName, { user });
  };

  const askAI = () => {
    if (!participantId) {
      Alert.alert(
        'Account information missing',
        'Please log out and log in again before opening AI Chat.'
      );
      return;
    }

    navigation.navigate('AIChat', { user });
  };

  return (
    <View style={styles.container}>
      <View style={styles.backgroundBlob} />

      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={[
          styles.scrollContent,
          { paddingTop: insets.top + 12 },
        ]}
      >
        <View style={styles.header}>
          <View style={styles.headerLeft}>
            <Text style={styles.leafIcon}>🍃</Text>

            <Text style={styles.headerTitle}>
              AI Analysis
            </Text>
          </View>

          <Text style={styles.headerSubtitle}>
            Understand your wellness patterns
          </Text>
        </View>

        <View style={styles.introCard}>
          <View style={styles.introIconCircle}>
            <Text style={styles.introEmoji}>🌿</Text>
          </View>

          <View style={styles.introTextContainer}>
            <Text style={styles.introTitle}>
              Your wellness overview
            </Text>

            <Text style={styles.introDescription}>
              Explore your mood check-ins and notice
              how you've been feeling over time.
            </Text>
          </View>
        </View>

        <View style={styles.periodHeader}>
          <Text style={styles.sectionTitle}>
            Mood Trends
          </Text>

          <View style={styles.periodToggle}>
            {['Week', 'Month'].map((item) => {
              const selected = period === item;

              return (
                <TouchableOpacity
                  key={item}
                  style={[
                    styles.periodButton,
                    selected && styles.selectedPeriodButton,
                  ]}
                  onPress={() => setPeriod(item)}
                  activeOpacity={0.8}
                  accessibilityRole="button"
                  accessibilityState={{ selected }}
                >
                  <Text
                    style={[
                      styles.periodButtonText,
                      selected &&
                        styles.selectedPeriodButtonText,
                    ]}
                  >
                    {item}
                  </Text>
                </TouchableOpacity>
              );
            })}
          </View>
        </View>

        <View style={styles.chartCard}>
          <View style={styles.chartCardHeader}>
            <View>
              <Text style={styles.cardTitle}>
                Mood over time
              </Text>

              <Text style={styles.cardSubtitle}>
                Your saved check-ins
              </Text>
            </View>

            <View style={styles.chartLegend}>
              <View style={styles.legendDot} />

              <Text style={styles.legendText}>
                Mood
              </Text>
            </View>
          </View>

          {loading ? (
            <View style={styles.loadingContainer}>
              <ActivityIndicator
                size="large"
                color={PURPLE}
              />

              <Text style={styles.loadingText}>
                Loading your mood data...
              </Text>
            </View>
          ) : (
            <>
              <MoodChart points={points} />

              <View style={styles.chartFooter}>
                <View style={styles.chartStat}>
                  <Text style={styles.chartStatLabel}>
                    Average mood
                  </Text>

                  <Text style={styles.chartStatValue}>
                    {average === null
                      ? '—'
                      : `${Math.round(average)}/100`}
                  </Text>
                </View>

                <View style={styles.chartStat}>
                  <Text style={styles.chartStatLabel}>
                    Check-ins
                  </Text>

                  <Text style={styles.chartStatValue}>
                    {totalCheckins}
                  </Text>
                </View>

                <View style={styles.chartStat}>
                  <Text style={styles.chartStatLabel}>
                    Overall feeling
                  </Text>

                  <Text style={styles.chartStatValue}>
                    {getMoodDescription(average)}
                  </Text>
                </View>
              </View>
            </>
          )}

          {!!loadError && (
            <View style={styles.errorContainer}>
              <Text style={styles.errorText}>
                {loadError}
              </Text>

              <TouchableOpacity
                style={styles.retryButton}
                onPress={() => loadCheckins(true)}
                disabled={refreshing}
                accessibilityRole="button"
              >
                <Text style={styles.retryButtonText}>
                  {refreshing ? 'Refreshing...' : 'Try again'}
                </Text>
              </TouchableOpacity>
            </View>
          )}

          {!loading && !loadError && (
            <TouchableOpacity
              style={[
                styles.refreshButton,
                refreshing && styles.refreshButtonDisabled,
              ]}
              onPress={() => loadCheckins(true)}
              disabled={refreshing}
              activeOpacity={0.8}
              accessibilityRole="button"
              accessibilityLabel="Refresh mood data"
            >
              {refreshing ? (
                <ActivityIndicator
                  size="small"
                  color={PURPLE}
                />
              ) : (
                <Text style={styles.refreshIcon}>⟳</Text>
              )}

              <Text style={styles.refreshButtonText}>
                {refreshing ? 'Refreshing...' : 'Refresh'}
              </Text>
            </TouchableOpacity>
          )}
        </View>

        <View style={styles.sectionHeader}>
          <Text style={styles.sectionTitle}>
            Insights
          </Text>

          <Text style={styles.sectionSubtitle}>
            What your check-ins may be showing
          </Text>
        </View>

        {loading ? (
          <View style={styles.smallLoading}>
            <ActivityIndicator color={PURPLE} />
          </View>
        ) : (
          <View style={styles.insightsList}>
            {insights.map((insight, index) => (
              <View
                key={`${insight.title}-${index}`}
                style={styles.insightCard}
              >
                <View style={styles.insightIconCircle}>
                  <Text style={styles.insightEmoji}>
                    {insight.emoji}
                  </Text>
                </View>

                <View style={styles.insightContent}>
                  <Text style={styles.insightTitle}>
                    {insight.title}
                  </Text>

                  <Text style={styles.insightDescription}>
                    {insight.description}
                  </Text>
                </View>
              </View>
            ))}
          </View>
        )}

        <View style={styles.sectionHeader}>
          <Text style={styles.sectionTitle}>
            Key Patterns
          </Text>

          <Text style={styles.sectionSubtitle}>
            Feelings selected in your check-ins
          </Text>
        </View>

        <View style={styles.patternsCard}>
          {loading ? (
            <ActivityIndicator color={PURPLE} />
          ) : keyPatterns.length === 0 ? (
            <View style={styles.emptyPatterns}>
              <Text style={styles.emptyPatternsEmoji}>
                🌱
              </Text>

              <Text style={styles.emptyPatternsTitle}>
                Your patterns will appear here
              </Text>

              <Text style={styles.emptyPatternsDescription}>
                Select feelings when saving a mood
                check-in to start seeing recurring patterns.
              </Text>
            </View>
          ) : (
            <>
              {keyPatterns.map(([feeling, count], index) => (
                <View
                  key={feeling}
                  style={[
                    styles.patternRow,
                    index !== keyPatterns.length - 1 &&
                      styles.patternRowBorder,
                  ]}
                >
                  <View style={styles.patternLeft}>
                    <View style={styles.patternDot} />

                    <Text style={styles.patternName}>
                      {feeling}
                    </Text>
                  </View>

                  <Text style={styles.patternCount}>
                    {count} {count === 1 ? 'time' : 'times'}
                  </Text>
                </View>
              ))}

              <Text style={styles.patternNote}>
                These patterns describe your saved check-ins;
                they do not establish what caused a feeling.
              </Text>
            </>
          )}
        </View>

        {/* AI-GENERATED WELLNESS ANALYSIS */}
        <View style={styles.sectionHeader}>
          <Text style={styles.sectionTitle}>
            Personalised AI Analysis
          </Text>

          <Text style={styles.sectionSubtitle}>
            Reflections based on your check-ins and assessments
          </Text>
        </View>

        <View style={styles.aiAnalysisCard}>
          {aiLoading ? (
            <View style={styles.aiAnalysisLoading}>
              <ActivityIndicator
                size="small"
                color={PURPLE}
              />

              <Text style={styles.aiAnalysisMuted}>
                Analysing your wellness history...
              </Text>
            </View>
          ) : aiError ? (
            <View>
              <Text style={styles.aiAnalysisError}>
                {aiError}
              </Text>

              <TouchableOpacity
                style={styles.aiAnalysisRetry}
                onPress={() => loadAIAnalysis(true)}
                disabled={aiRefreshing}
                accessibilityRole="button"
              >
                {aiRefreshing ? (
                  <ActivityIndicator
                    size="small"
                    color="#FFFFFF"
                  />
                ) : (
                  <Text style={styles.aiAnalysisRetryText}>
                    Try again
                  </Text>
                )}
              </TouchableOpacity>
            </View>
          ) : aiAnalysis ? (
            <>
              <Text style={styles.aiAnalysisHeading}>
                Your wellness reflection
              </Text>

              <Text style={styles.aiAnalysisBody}>
                {aiAnalysis.summary ||
                  'Keep checking in to build a clearer picture of your wellness over time.'}
              </Text>

              {!!aiAnalysis.mood_trend && (
                <>
                  <Text style={styles.aiAnalysisSubheading}>
                    Mood trend
                  </Text>

                  <Text style={styles.aiAnalysisBody}>
                    {aiAnalysis.mood_trend}
                  </Text>
                </>
              )}

              {Array.isArray(aiAnalysis.key_patterns) &&
                aiAnalysis.key_patterns.length > 0 && (
                  <>
                    <Text style={styles.aiAnalysisSubheading}>
                      Patterns to notice
                    </Text>

                    {aiAnalysis.key_patterns.map(
                      (pattern, index) => {
                        const patternText =
                          typeof pattern === 'string'
                            ? pattern
                            : pattern?.description ||
                              pattern?.pattern ||
                              pattern?.title ||
                              '';

                        if (!patternText) {
                          return null;
                        }

                        return (
                          <View
                            key={`ai-pattern-${index}`}
                            style={styles.aiAnalysisBulletRow}
                          >
                            <Text style={styles.aiAnalysisBullet}>
                              •
                            </Text>

                            <Text style={styles.aiAnalysisBody}>
                              {patternText}
                            </Text>
                          </View>
                        );
                      }
                    )}
                  </>
                )}

              {Array.isArray(aiAnalysis.recommendations) &&
                aiAnalysis.recommendations.length > 0 && (
                  <>
                    <Text style={styles.aiAnalysisSubheading}>
                      Suggested next steps
                    </Text>

                    {aiAnalysis.recommendations.map(
                      (recommendation, index) => (
                        <View
                          key={`ai-recommendation-${index}`}
                          style={styles.aiRecommendation}
                        >
                          <Text style={styles.aiRecommendationTitle}>
                            {recommendation.title ||
                              'Wellness suggestion'}
                          </Text>

                          {!!recommendation.message && (
                            <Text style={styles.aiAnalysisBody}>
                              {recommendation.message}
                            </Text>
                          )}

                          {!!recommendation.activity &&
                            recommendation.activity !== 'none' && (
                              <TouchableOpacity
                                style={styles.aiActivityButton}
                                onPress={() =>
                                  openRecommendedActivity(
                                    recommendation.activity
                                  )
                                }
                                activeOpacity={0.7}
                                accessibilityRole="button"
                                accessibilityLabel={
                                  `Open suggested activity: ${
                                    String(
                                      recommendation.activity
                                    ).replace(/_/g, ' ')
                                  }`
                                }
                              >
                                <Text style={styles.aiActivity}>
                                  Try this activity:{' '}
                                  {String(
                                    recommendation.activity
                                  ).replace(/_/g, ' ')}
                                  {' →'}
                                </Text>
                              </TouchableOpacity>
                            )}
                        </View>
                      )
                    )}
                  </>
                )}

              {!!aiAnalysis.limitations && (
                <Text style={styles.aiAnalysisDisclaimer}>
                  {aiAnalysis.limitations}
                </Text>
              )}

              <TouchableOpacity
                style={styles.aiAnalysisRefresh}
                onPress={() => loadAIAnalysis(true)}
                disabled={aiRefreshing}
                activeOpacity={0.8}
                accessibilityRole="button"
              >
                {aiRefreshing ? (
                  <ActivityIndicator
                    size="small"
                    color={PURPLE}
                  />
                ) : (
                  <Text style={styles.aiAnalysisRefreshText}>
                    ↻ Refresh AI analysis
                  </Text>
                )}
              </TouchableOpacity>
            </>
          ) : (
            <Text style={styles.aiAnalysisMuted}>
              Your personalised analysis will appear here when available.
            </Text>
          )}
        </View>

        {/* EXISTING ASK AI CARD */}
        <View style={styles.aiCard}>
          <View style={styles.aiCardTop}>
            <View style={styles.aiIconCircle}>
              <Text style={styles.aiEmoji}>💬</Text>
            </View>

            <View style={styles.aiCardText}>
              <Text style={styles.aiCardTitle}>
                Want to talk about it?
              </Text>

              <Text style={styles.aiCardDescription}>
                Ask the AI wellness assistant for supportive
                suggestions or help reflecting on your feelings.
              </Text>
            </View>
          </View>

          <TouchableOpacity
            style={styles.askAIButton}
            onPress={askAI}
            activeOpacity={0.8}
            accessibilityRole="button"
          >
            <Text style={styles.askAIButtonText}>
              Ask AI
            </Text>

            <Text style={styles.askAIArrow}>→</Text>
          </TouchableOpacity>
        </View>

        <Text style={styles.disclaimer}>
          This analysis is based on your saved check-ins
          and is intended for general wellness reflection.
          It is not a medical diagnosis.
        </Text>

        <View style={styles.bottomSpace} />
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: BACKGROUND,
  },

  scrollContent: {
    paddingBottom: 30,
  },

  backgroundBlob: {
    position: 'absolute',
    top: -85,
    right: -90,
    width: 330,
    height: 220,
    backgroundColor: '#EBCDD6',
    borderBottomLeftRadius: 180,
    borderBottomRightRadius: 100,
    borderTopLeftRadius: 160,
  },

  header: {
    marginHorizontal: 20,
  },

  headerLeft: {
    flexDirection: 'row',
    alignItems: 'center',
  },

  leafIcon: {
    fontSize: 23,
    marginRight: 7,
  },

  headerTitle: {
    fontSize: 24,
    fontWeight: '700',
    color: '#3F4B49',
  },

  headerSubtitle: {
    marginTop: 6,
    marginLeft: 31,
    fontSize: 12,
    color: '#65536D',
  },

  introCard: {
    marginTop: 22,
    marginHorizontal: 18,
    padding: 16,
    borderRadius: 18,
    backgroundColor: '#F7F1F8',
    flexDirection: 'row',
    alignItems: 'center',
  },

  introIconCircle: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: '#E4D7E9',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12,
  },

  introEmoji: {
    fontSize: 25,
  },

  introTextContainer: {
    flex: 1,
  },

  introTitle: {
    fontSize: 15,
    fontWeight: '800',
    color: PURPLE,
  },

  introDescription: {
    marginTop: 5,
    fontSize: 12,
    lineHeight: 18,
    color: '#65536D',
  },

  periodHeader: {
    marginTop: 24,
    marginHorizontal: 20,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },

  sectionTitle: {
    fontSize: 18,
    fontWeight: '800',
    color: PURPLE,
  },

  periodToggle: {
    flexDirection: 'row',
    backgroundColor: '#EDE5EF',
    borderRadius: 18,
    padding: 3,
  },

  periodButton: {
    paddingVertical: 7,
    paddingHorizontal: 14,
    borderRadius: 15,
  },

  selectedPeriodButton: {
    backgroundColor: PURPLE,
  },

  periodButtonText: {
    fontSize: 11,
    fontWeight: '600',
    color: '#65536D',
  },

  selectedPeriodButtonText: {
    color: '#FFFFFF',
    fontWeight: '800',
  },

  chartCard: {
    marginTop: 13,
    marginHorizontal: 16,
    backgroundColor: '#FFFFFF',
    borderRadius: 20,
    padding: 16,
    elevation: 3,
    shadowColor: '#4A2E6B',
    shadowOpacity: 0.07,
    shadowRadius: 5,
    shadowOffset: {
      width: 0,
      height: 3,
    },
  },

  chartCardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },

  cardTitle: {
    fontSize: 15,
    fontWeight: '800',
    color: PURPLE,
  },

  cardSubtitle: {
    marginTop: 4,
    fontSize: 11,
    color: MUTED_PURPLE,
  },

  chartLegend: {
    flexDirection: 'row',
    alignItems: 'center',
  },

  legendDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: PURPLE,
    marginRight: 5,
  },

  legendText: {
    fontSize: 10,
    color: MUTED_PURPLE,
  },

  chartContainer: {
    marginTop: 12,
    position: 'relative',
    width: '100%',
    alignItems: 'center',
  },

  chartEmptyOverlay: {
    position: 'absolute',
    left: 42,
    right: 10,
    top: 48,
    bottom: 35,
    alignItems: 'center',
    justifyContent: 'center',
  },

  chartEmptyText: {
    textAlign: 'center',
    fontSize: 11,
    lineHeight: 17,
    color: MUTED_PURPLE,
  },

  chartFooter: {
    marginTop: 10,
    paddingTop: 14,
    borderTopWidth: 1,
    borderTopColor: '#EEE7F0',
    flexDirection: 'row',
    justifyContent: 'space-between',
  },

  chartStat: {
    flex: 1,
    alignItems: 'center',
    paddingHorizontal: 2,
  },

  chartStatLabel: {
    fontSize: 9,
    color: MUTED_PURPLE,
    textAlign: 'center',
  },

  chartStatValue: {
    marginTop: 5,
    fontSize: 13,
    fontWeight: '800',
    color: PURPLE,
    textAlign: 'center',
  },

  loadingContainer: {
    height: 190,
    alignItems: 'center',
    justifyContent: 'center',
  },

  loadingText: {
    marginTop: 10,
    fontSize: 12,
    color: MUTED_PURPLE,
  },

  errorContainer: {
    padding: 12,
    backgroundColor: '#F8EEEE',
    borderRadius: 12,
    marginTop: 12,
  },

  errorText: {
    fontSize: 12,
    lineHeight: 18,
    color: '#8A3434',
  },

  retryButton: {
    alignSelf: 'flex-start',
    marginTop: 8,
    paddingVertical: 7,
    paddingHorizontal: 12,
    backgroundColor: PURPLE,
    borderRadius: 10,
  },

  retryButtonText: {
    color: '#FFFFFF',
    fontSize: 11,
    fontWeight: '700',
  },

  refreshButton: {
    alignSelf: 'center',
    marginTop: 12,
    paddingVertical: 9,
    paddingHorizontal: 16,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: '#C9B8E8',
    backgroundColor: '#F7F1F8',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 7,
  },

  refreshButtonDisabled: {
    opacity: 0.7,
  },

  refreshIcon: {
    fontSize: 20,
    lineHeight: 22,
    color: PURPLE,
    fontWeight: '700',
  },

  refreshButtonText: {
    fontSize: 12,
    color: PURPLE,
    fontWeight: '700',
  },

  sectionHeader: {
    marginTop: 25,
    marginHorizontal: 20,
    marginBottom: 12,
  },

  sectionSubtitle: {
    marginTop: 5,
    fontSize: 11,
    color: '#65536D',
  },

  insightsList: {
    marginHorizontal: 16,
    gap: 10,
  },

  insightCard: {
    backgroundColor: '#F7F1F8',
    borderRadius: 16,
    padding: 14,
    flexDirection: 'row',
    alignItems: 'flex-start',
  },

  insightIconCircle: {
    width: 39,
    height: 39,
    borderRadius: 20,
    backgroundColor: '#E6D9EC',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 11,
  },

  insightEmoji: {
    fontSize: 20,
  },

  insightContent: {
    flex: 1,
  },

  insightTitle: {
    fontSize: 13,
    fontWeight: '800',
    color: PURPLE,
  },

  insightDescription: {
    marginTop: 5,
    fontSize: 11,
    lineHeight: 17,
    color: '#65536D',
  },

  smallLoading: {
    padding: 20,
  },

  patternsCard: {
    marginHorizontal: 16,
    backgroundColor: '#FFFFFF',
    borderRadius: 18,
    paddingHorizontal: 16,
    paddingVertical: 8,
    elevation: 2,
    shadowColor: '#4A2E6B',
    shadowOpacity: 0.05,
    shadowRadius: 4,
    shadowOffset: {
      width: 0,
      height: 2,
    },
  },

  emptyPatterns: {
    alignItems: 'center',
    paddingVertical: 24,
  },

  emptyPatternsEmoji: {
    fontSize: 30,
  },

  emptyPatternsTitle: {
    marginTop: 10,
    fontSize: 13,
    fontWeight: '800',
    color: PURPLE,
    textAlign: 'center',
  },

  emptyPatternsDescription: {
    marginTop: 6,
    fontSize: 11,
    lineHeight: 17,
    color: MUTED_PURPLE,
    textAlign: 'center',
  },

  patternRow: {
    minHeight: 48,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },

  patternRowBorder: {
    borderBottomWidth: 1,
    borderBottomColor: '#EEE7F0',
  },

  patternLeft: {
    flexDirection: 'row',
    alignItems: 'center',
  },

  patternDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: '#9B7CB0',
    marginRight: 9,
  },

  patternName: {
    fontSize: 13,
    fontWeight: '600',
    color: PURPLE,
  },

  patternCount: {
    fontSize: 11,
    color: MUTED_PURPLE,
  },

  patternNote: {
    marginTop: 8,
    marginBottom: 10,
    fontSize: 10,
    lineHeight: 15,
    color: MUTED_PURPLE,
  },

  // AI-GENERATED WELLNESS ANALYSIS
  aiAnalysisCard: {
    marginHorizontal: 16,
    padding: 17,
    borderRadius: 18,
    backgroundColor: '#FFFFFF',
    elevation: 2,
    shadowColor: '#4A2E6B',
    shadowOpacity: 0.06,
    shadowRadius: 4,
    shadowOffset: {
      width: 0,
      height: 2,
    },
  },

  aiAnalysisLoading: {
    minHeight: 70,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 10,
  },

  aiAnalysisMuted: {
    fontSize: 12,
    lineHeight: 18,
    color: MUTED_PURPLE,
    textAlign: 'center',
  },

  aiAnalysisHeading: {
    fontSize: 15,
    fontWeight: '800',
    color: PURPLE,
  },

  aiAnalysisSubheading: {
    marginTop: 17,
    marginBottom: 7,
    fontSize: 13,
    fontWeight: '800',
    color: PURPLE,
  },

  aiAnalysisBody: {
    flex: 1,
    fontSize: 12,
    lineHeight: 19,
    color: '#65536D',
  },

  aiAnalysisBulletRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    marginTop: 7,
    gap: 8,
  },

  aiAnalysisBullet: {
    fontSize: 14,
    color: PURPLE,
  },

  aiRecommendation: {
    marginTop: 8,
    padding: 12,
    borderRadius: 12,
    backgroundColor: '#F7F1F8',
  },

  aiRecommendationTitle: {
    marginBottom: 5,
    fontSize: 12,
    fontWeight: '800',
    color: PURPLE,
  },

  // NEW: Clickable suggested activity
  aiActivityButton: {
    alignSelf: 'flex-start',
    marginTop: 7,
    paddingVertical: 4,
  },

  aiActivity: {
    fontSize: 11,
    lineHeight: 16,
    color: PURPLE,
    fontWeight: '700',
    textTransform: 'capitalize',
    textDecorationLine: 'underline',
  },

  aiAnalysisDisclaimer: {
    marginTop: 14,
    fontSize: 10,
    lineHeight: 16,
    color: MUTED_PURPLE,
  },

  aiAnalysisError: {
    fontSize: 12,
    lineHeight: 18,
    color: '#8A3434',
  },

  aiAnalysisRetry: {
    marginTop: 12,
    alignSelf: 'flex-start',
    minWidth: 90,
    minHeight: 36,
    paddingHorizontal: 13,
    borderRadius: 10,
    backgroundColor: PURPLE,
    alignItems: 'center',
    justifyContent: 'center',
  },

  aiAnalysisRetryText: {
    fontSize: 11,
    fontWeight: '700',
    color: '#FFFFFF',
  },

  aiAnalysisRefresh: {
    marginTop: 16,
    paddingVertical: 10,
    alignItems: 'center',
  },

  aiAnalysisRefreshText: {
    fontSize: 12,
    fontWeight: '700',
    color: PURPLE,
  },

  // EXISTING ASK AI CARD
  aiCard: {
    marginTop: 24,
    marginHorizontal: 16,
    padding: 17,
    borderRadius: 20,
    backgroundColor: '#CFC1E1',
  },

  aiCardTop: {
    flexDirection: 'row',
    alignItems: 'flex-start',
  },

  aiIconCircle: {
    width: 43,
    height: 43,
    borderRadius: 22,
    backgroundColor: '#F5EFF8',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 11,
  },

  aiEmoji: {
    fontSize: 21,
  },

  aiCardText: {
    flex: 1,
  },

  aiCardTitle: {
    fontSize: 15,
    fontWeight: '800',
    color: PURPLE,
  },

  aiCardDescription: {
    marginTop: 5,
    fontSize: 11,
    lineHeight: 17,
    color: '#574465',
  },

  askAIButton: {
    marginTop: 15,
    height: 43,
    borderRadius: 13,
    backgroundColor: PURPLE,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
  },

  askAIButtonText: {
    fontSize: 13,
    fontWeight: '800',
    color: '#FFFFFF',
  },

  askAIArrow: {
    marginLeft: 8,
    fontSize: 17,
    fontWeight: '800',
    color: '#FFFFFF',
  },

  disclaimer: {
    marginTop: 16,
    marginHorizontal: 24,
    fontSize: 10,
    lineHeight: 16,
    textAlign: 'center',
    color: '#65536D',
  },

  bottomSpace: {
    height: 100,
  },
});