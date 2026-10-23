
import React, { useCallback, useMemo, useState } from 'react';

import {
  View,
  Text,
  StyleSheet,
  TextInput,
  TouchableOpacity,
  ScrollView,
  ActivityIndicator,
  Alert,
  KeyboardAvoidingView,
  Platform,
} from 'react-native';

import { Ionicons } from '@expo/vector-icons';
import { useFocusEffect } from '@react-navigation/native';

import {
  getJournalEntries,
  saveJournalEntry,
  updateJournalEntry,
  deleteJournalEntry,
  getMoodCheckins,
} from '../services/api';

const COLORS = {
  background: '#F8F8F3',
  green: '#304F4A',
  text: '#30433E',
  muted: '#89928E',
  border: '#DCE3DD',
  card: '#FFFFFF',
  entry: '#F7F2E8',
  accent: '#6F947A',
};

function getLocalDate(date = new Date()) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');

  return `${year}-${month}-${day}`;
}

function getMonthKey(date) {
  return `${date.getFullYear()}-${String(
    date.getMonth() + 1
  ).padStart(2, '0')}`;
}

function getMonthLabel(date) {
  return date.toLocaleDateString('en-ZA', {
    month: 'long',
    year: 'numeric',
  });
}

function formatDate(dateString) {
  if (!dateString) return '';

  const [year, month, day] = dateString
    .slice(0, 10)
    .split('-')
    .map(Number);

  return new Date(year, month - 1, day).toLocaleDateString(
    'en-ZA',
    {
      weekday: 'long',
      day: 'numeric',
      month: 'long',
      year: 'numeric',
    }
  );
}

function getEntriesFromResponse(response) {
  if (Array.isArray(response)) return response;
  if (Array.isArray(response?.entries)) return response.entries;
  if (Array.isArray(response?.journal_entries)) {
    return response.journal_entries;
  }

  return [];
}

function getCheckinsFromResponse(response) {
  if (Array.isArray(response)) return response;
  if (Array.isArray(response?.checkins)) return response.checkins;
  if (Array.isArray(response?.check_ins)) return response.check_ins;
  if (Array.isArray(response?.entries)) return response.entries;

  return [];
}

function getCheckinDate(checkin) {
  const date = checkin?.checkin_date;

  return typeof date === 'string' ? date.slice(0, 10) : '';
}

function getMoodEmoji(mood) {
  const value = String(mood || '').trim().toLowerCase();

  const moods = {
    awful: '😞',
    'not great': '😕',
    okay: '😐',
    good: '🙂',
    amazing: '😄',
  };

  return moods[value] || null;
}

function getFeelingsList(feelings) {
  if (Array.isArray(feelings)) {
    return feelings.filter(
      (item) => typeof item === 'string' && item.trim()
    );
  }

  if (typeof feelings === 'string') {
    try {
      const decoded = JSON.parse(feelings);

      if (Array.isArray(decoded)) {
        return decoded.filter(
          (item) => typeof item === 'string' && item.trim()
        );
      }
    } catch {
      // Ignore invalid JSON in stored feelings.
    }
  }

  return [];
}

function getCheckinTimestamp(checkin) {
  const timestamp = checkin?.created_at
    ? new Date(checkin.created_at).getTime()
    : 0;

  return Number.isFinite(timestamp) ? timestamp : 0;
}

export default function GratitudeJournalScreen({ route }) {
  const user = route?.params?.user || {};
  const participantId = user.participant_id;

  const today = getLocalDate();
  const isFutureDate = (date) => date > today;

  const [monthDate, setMonthDate] = useState(() => {
    const now = new Date();

    return new Date(now.getFullYear(), now.getMonth(), 1);
  });

  const [selectedDate, setSelectedDate] = useState(today);

  const [entries, setEntries] = useState([]);
  const [checkins, setCheckins] = useState([]);

  const [title, setTitle] = useState('');
  const [content, setContent] = useState('');
  const [editingEntry, setEditingEntry] = useState(null);

  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);

  const [message, setMessage] = useState('');
  const [errorMessage, setErrorMessage] = useState('');

  const monthKey = getMonthKey(monthDate);
  const selectedDateIsFuture = isFutureDate(selectedDate);

  // Load journal entries and mood check-ins.
  const loadEntries = useCallback(async () => {
    if (!participantId) {
      setEntries([]);
      setCheckins([]);
      setErrorMessage(
        'Your account could not be identified. Please log in again.'
      );
      return;
    }

    try {
      setLoading(true);
      setErrorMessage('');

      const results = await Promise.allSettled([
        getJournalEntries(participantId, null, monthKey),
        getMoodCheckins(participantId),
      ]);

      if (results[0].status === 'fulfilled') {
        setEntries(getEntriesFromResponse(results[0].value));
      } else {
        setErrorMessage(
          results[0].reason?.message ||
            'Could not load your journal entries.'
        );
      }

      if (results[1].status === 'fulfilled') {
        setCheckins(getCheckinsFromResponse(results[1].value));
      } else {
        setCheckins([]);

        setErrorMessage((current) =>
          current
            ? `${current} Mood history could not be loaded.`
            : 'Mood history could not be loaded.'
        );
      }
    } catch (error) {
      setErrorMessage(
        error.message || 'Could not load your journal.'
      );
    } finally {
      setLoading(false);
    }
  }, [participantId, monthKey]);

  useFocusEffect(
    useCallback(() => {
      loadEntries();
    }, [loadEntries])
  );

  const entriesForSelectedDate = useMemo(
    () =>
      entries.filter(
        (item) => item.entry_date?.slice(0, 10) === selectedDate
      ),
    [entries, selectedDate]
  );

  const markedDates = useMemo(
    () =>
      new Set(
        entries.map((item) => item.entry_date?.slice(0, 10))
      ),
    [entries]
  );

  // Find the latest mood check-in for each date.
  const moodsByDate = useMemo(() => {
    const result = {};

    checkins.forEach((item) => {
      const date = getCheckinDate(item);

      if (!date || !item.mood_value) return;

      const current = result[date];
      const itemTime = getCheckinTimestamp(item);
      const currentTime = current
        ? getCheckinTimestamp(current)
        : -1;

      if (
        !current ||
        itemTime > currentTime ||
        (
          itemTime === currentTime &&
          Number(item.id || 0) > Number(current.id || 0)
        )
      ) {
        result[date] = item;
      }
    });

    return result;
  }, [checkins]);

  const checkinsForSelectedDate = useMemo(
    () =>
      checkins.filter(
        (item) => getCheckinDate(item) === selectedDate
      ),
    [checkins, selectedDate]
  );

  const latestCheckinForSelectedDate = useMemo(() => {
    if (checkinsForSelectedDate.length === 0) return null;

    return [...checkinsForSelectedDate].sort((a, b) => {
      const difference =
        getCheckinTimestamp(b) - getCheckinTimestamp(a);

      if (difference !== 0) return difference;

      return Number(b.id || 0) - Number(a.id || 0);
    })[0];
  }, [checkinsForSelectedDate]);

  // Create a Monday-starting calendar.
  const calendarDays = useMemo(() => {
    const year = monthDate.getFullYear();
    const month = monthDate.getMonth();

    const firstDay = new Date(year, month, 1);
    const daysInMonth = new Date(year, month + 1, 0).getDate();
    const emptyDays = (firstDay.getDay() + 6) % 7;

    return [
      ...Array(emptyDays).fill(null),
      ...Array.from(
        { length: daysInMonth },
        (_, index) => new Date(year, month, index + 1)
      ),
    ];
  }, [monthDate]);

  const clearEditor = () => {
    setEditingEntry(null);
    setTitle('');
    setContent('');
    setMessage('');
    setErrorMessage('');
  };

  const changeMonth = (amount) => {
    const nextMonth = new Date(
      monthDate.getFullYear(),
      monthDate.getMonth() + amount,
      1
    );

    setMonthDate(nextMonth);

    setSelectedDate(
      getLocalDate(
        new Date(
          nextMonth.getFullYear(),
          nextMonth.getMonth(),
          1
        )
      )
    );

    clearEditor();
  };

  const startNewEntry = () => {
    clearEditor();
  };

  const openEntry = (item) => {
    if (isFutureDate(item.entry_date?.slice(0, 10))) {
      setErrorMessage(
        'Entries for future dates cannot be edited.'
      );
      return;
    }

    setEditingEntry(item);
    setTitle(item.title || '');
    setContent(item.content || '');
    setMessage('');
    setErrorMessage('');
  };

  const handleSave = async () => {
    if (!participantId) {
      setErrorMessage(
        'Your account could not be identified. Please log in again.'
      );
      return;
    }

    if (isFutureDate(selectedDate)) {
      setMessage('');
      setErrorMessage(
        'You cannot save a journal entry for a future date.'
      );
      return;
    }

    if (!content.trim()) {
      setMessage('');
      setErrorMessage('Please write something before saving.');
      return;
    }

    try {
      setSaving(true);
      setMessage('');
      setErrorMessage('');

      if (editingEntry) {
        await updateJournalEntry(
          participantId,
          editingEntry.id,
          title.trim(),
          content.trim(),
          selectedDate
        );
      } else {
        await saveJournalEntry(
          participantId,
          title.trim(),
          content.trim(),
          selectedDate
        );
      }

      await loadEntries();

      setEditingEntry(null);
      setTitle('');
      setContent('');

      setMessage(
        editingEntry
          ? 'Entry updated successfully.'
          : 'Entry saved successfully.'
      );
    } catch (error) {
      setErrorMessage(
        error.message || 'Could not save your journal entry.'
      );
    } finally {
      setSaving(false);
    }
  };

  const confirmDelete = (item) => {
    Alert.alert(
      'Delete journal entry',
      'Are you sure you want to delete this entry? This cannot be undone.',
      [
        {
          text: 'Cancel',
          style: 'cancel',
        },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: async () => {
            try {
              setErrorMessage('');
              setMessage('');

              await deleteJournalEntry(participantId, item.id);

              if (editingEntry?.id === item.id) {
                startNewEntry();
              }

              await loadEntries();
              setMessage('Entry deleted.');
            } catch (error) {
              setErrorMessage(
                error.message || 'Could not delete this entry.'
              );
            }
          },
        },
      ]
    );
  };

  return (
    <KeyboardAvoidingView
      style={styles.keyboardContainer}
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
    >
      <ScrollView
        style={styles.container}
        contentContainerStyle={styles.content}
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
        keyboardDismissMode={
          Platform.OS === 'ios' ? 'interactive' : 'on-drag'
        }
      >
        <Text style={styles.title}>Gratitude Journal</Text>

        <Text style={styles.subtitle}>
          Take a moment to reflect on something positive.
        </Text>

        {/* Monthly calendar */}
        <View style={styles.calendarCard}>
          <View style={styles.monthHeader}>
            <TouchableOpacity
              style={styles.monthButton}
              onPress={() => changeMonth(-1)}
              accessibilityRole="button"
              accessibilityLabel="Previous month"
            >
              <Ionicons
                name="chevron-back"
                size={22}
                color={COLORS.green}
              />
            </TouchableOpacity>

            <Text style={styles.monthTitle}>
              {getMonthLabel(monthDate)}
            </Text>

            <TouchableOpacity
              style={styles.monthButton}
              onPress={() => changeMonth(1)}
              accessibilityRole="button"
              accessibilityLabel="Next month"
            >
              <Ionicons
                name="chevron-forward"
                size={22}
                color={COLORS.green}
              />
            </TouchableOpacity>
          </View>

          <View style={styles.weekRow}>
            {['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'].map(
              (day) => (
                <Text key={day} style={styles.weekday}>
                  {day}
                </Text>
              )
            )}
          </View>

          <View style={styles.calendarGrid}>
            {calendarDays.map((date, index) => {
              if (!date) {
                return (
                  <View
                    key={`empty-${index}`}
                    style={styles.dayCell}
                  />
                );
              }

              const dateString = getLocalDate(date);
              const isSelected = dateString === selectedDate;
              const hasEntries = markedDates.has(dateString);
              const isToday = dateString === today;

              const moodEmoji = getMoodEmoji(
                moodsByDate[dateString]?.mood_value
              );

              return (
                <TouchableOpacity
                  key={dateString}
                  style={styles.dayCell}
                  onPress={() => {
                    setSelectedDate(dateString);
                    clearEditor();
                  }}
                  accessibilityRole="button"
                  accessibilityLabel={`${date.getDate()} ${
                    moodEmoji
                      ? `mood ${moodsByDate[dateString]?.mood_value}`
                      : ''
                  } ${
                    hasEntries ? 'has journal entries' : ''
                  }`}
                >
                  {/* Mood emoji above the date number */}
                  {moodEmoji ? (
                    <Text style={styles.moodEmoji}>
                      {moodEmoji}
                    </Text>
                  ) : (
                    <View style={styles.moodEmojiPlaceholder} />
                  )}

                  <View
                    style={[
                      styles.dayCircle,
                      isToday && styles.todayCircle,
                      isSelected && styles.selectedDayCircle,
                    ]}
                  >
                    <Text
                      style={[
                        styles.dayNumber,
                        isSelected && styles.selectedDayNumber,
                      ]}
                    >
                      {date.getDate()}
                    </Text>
                  </View>

                  {/* Journal marker remains visible alongside the mood */}
                  {hasEntries && (
                    <View style={styles.dayDot} />
                  )}
                </TouchableOpacity>
              );
            })}
          </View>

          <View style={styles.calendarLegend}>
            <View style={styles.legendItem}>
              <Text style={styles.legendEmoji}>🙂</Text>
              <Text style={styles.legendText}>Mood check-in</Text>
            </View>

            <View style={styles.legendItem}>
              <View style={styles.legendDot} />
              <Text style={styles.legendText}>Journal entry</Text>
            </View>
          </View>
        </View>

        {loading && (
          <ActivityIndicator
            style={styles.loader}
            size="small"
            color={COLORS.green}
          />
        )}

        {!!errorMessage && (
          <Text style={styles.errorMessage}>{errorMessage}</Text>
        )}

        {/* Mood information for the selected date */}
        {latestCheckinForSelectedDate && (
          <View style={styles.moodCard}>
            <Text style={styles.moodCardTitle}>
              Your mood that day
            </Text>

            <View style={styles.moodRow}>
              <Text style={styles.selectedMoodEmoji}>
                {getMoodEmoji(
                  latestCheckinForSelectedDate.mood_value
                ) || '🙂'}
              </Text>

              <Text style={styles.selectedMoodText}>
                {latestCheckinForSelectedDate.mood_value}
              </Text>
            </View>

            {getFeelingsList(
              latestCheckinForSelectedDate.feelings
            ).length > 0 && (
              <>
                <Text style={styles.feelingsTitle}>
                  Feelings you selected
                </Text>

                <View style={styles.feelingsRow}>
                  {getFeelingsList(
                    latestCheckinForSelectedDate.feelings
                  ).map((feeling, index) => (
                    <View
                      key={`${feeling}-${index}`}
                      style={styles.feelingChip}
                    >
                      <Text style={styles.feelingText}>
                        {feeling}
                      </Text>
                    </View>
                  ))}
                </View>
              </>
            )}

            {!!latestCheckinForSelectedDate.note?.trim() && (
              <>
                <Text style={styles.checkinNoteTitle}>
                  Your check-in note
                </Text>

                <Text style={styles.checkinNoteText}>
                  {latestCheckinForSelectedDate.note.trim()}
                </Text>
              </>
            )}

            {checkinsForSelectedDate.length > 1 && (
              <Text style={styles.additionalCheckins}>
                You recorded {checkinsForSelectedDate.length} check-ins
                on this day. The latest one is shown above.
              </Text>
            )}
          </View>
        )}

        {/* Journal entries for the selected date */}
        <View style={styles.previousSection}>
          <Text style={styles.sectionTitle}>
            {formatDate(selectedDate)}
          </Text>

          {!loading && entriesForSelectedDate.length === 0 && (
            <View style={styles.emptyCard}>
              <Ionicons
                name="book-outline"
                size={27}
                color={COLORS.accent}
              />

              <Text style={styles.emptyTitle}>
                No entries for this day
              </Text>

              <Text style={styles.emptyText}>
                {selectedDateIsFuture
                  ? 'This date has not arrived yet. You can write an entry once the day arrives.'
                  : 'Take a moment to write about something you appreciate.'}
              </Text>
            </View>
          )}

          {entriesForSelectedDate.map((item, index) => (
            <View
              key={String(item.id)}
              style={styles.entryCard}
            >
              <TouchableOpacity
                style={styles.entryOpenArea}
                onPress={() => openEntry(item)}
                activeOpacity={0.75}
              >
                <Text style={styles.entryNumber}>
                  Entry {index + 1}
                </Text>

                <Text style={styles.entryTitle}>
                  {item.title || 'A moment of gratitude'}
                </Text>

                <Text
                  style={styles.entryText}
                  numberOfLines={3}
                >
                  {item.content}
                </Text>

                <Text style={styles.openHint}>
                  {selectedDateIsFuture
                    ? 'Future-dated entries cannot be edited'
                    : 'Tap to view or edit'}
                </Text>
              </TouchableOpacity>

              {!selectedDateIsFuture && (
                <TouchableOpacity
                  style={styles.deleteButton}
                  onPress={() => confirmDelete(item)}
                  accessibilityRole="button"
                  accessibilityLabel="Delete journal entry"
                >
                  <Ionicons
                    name="trash-outline"
                    size={19}
                    color="#B64D49"
                  />
                </TouchableOpacity>
              )}
            </View>
          ))}
        </View>

        {/* Future dates cannot be used to create or edit entries */}
        {selectedDateIsFuture ? (
          <View style={styles.futureDateCard}>
            <Ionicons
              name="calendar-outline"
              size={30}
              color={COLORS.accent}
            />

            <Text style={styles.emptyTitle}>
              This date hasn't arrived yet
            </Text>

            <Text style={styles.emptyText}>
              You can create a gratitude entry when this day arrives.
              For now, you can browse your other dates.
            </Text>
          </View>
        ) : (
          <View style={styles.journalCard}>
            <Text style={styles.question}>
              {editingEntry
                ? 'Edit your entry'
                : 'What are you grateful for?'}
            </Text>

            <Text style={styles.editorDate}>
              For {formatDate(selectedDate)}
            </Text>

            <Text style={styles.fieldLabel}>Title (optional)</Text>

            <TextInput
              style={styles.titleInput}
              placeholder="Give this entry a title"
              placeholderTextColor="#A3ADA7"
              value={title}
              onChangeText={setTitle}
              maxLength={200}
              editable={!saving}
              returnKeyType="next"
              blurOnSubmit={false}
            />

            <Text style={styles.fieldLabel}>Your reflection</Text>

            <TextInput
              style={styles.input}
              placeholder="Today I'm grateful for..."
              placeholderTextColor="#A3ADA7"
              value={content}
              onChangeText={setContent}
              multiline
              textAlignVertical="top"
              maxLength={20000}
              editable={!saving}
              scrollEnabled={false}
            />

            {!!message && (
              <Text style={styles.message}>{message}</Text>
            )}

            <TouchableOpacity
              style={[
                styles.saveButton,
                saving && styles.disabledButton,
              ]}
              onPress={handleSave}
              disabled={saving}
              accessibilityRole="button"
            >
              {saving ? (
                <ActivityIndicator color="#FFFFFF" />
              ) : (
                <Text style={styles.saveButtonText}>
                  {editingEntry ? 'Update Entry' : 'Save Entry'}
                </Text>
              )}
            </TouchableOpacity>

            {editingEntry && (
              <TouchableOpacity
                style={styles.cancelButton}
                onPress={startNewEntry}
                disabled={saving}
              >
                <Text style={styles.cancelButtonText}>
                  Cancel editing
                </Text>
              </TouchableOpacity>
            )}
          </View>
        )}
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  keyboardContainer: {
    flex: 1,
  },

  container: {
    flex: 1,
    backgroundColor: COLORS.background,
  },

  content: {
    padding: 20,
    paddingBottom: 60,
  },

  title: {
    marginTop: 25,
    fontSize: 27,
    fontWeight: '700',
    color: COLORS.green,
  },

  subtitle: {
    marginTop: 8,
    fontSize: 13,
    color: COLORS.muted,
    lineHeight: 19,
  },

  calendarCard: {
    marginTop: 23,
    backgroundColor: COLORS.card,
    borderRadius: 20,
    padding: 15,
    elevation: 2,
  },

  monthHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 16,
  },

  monthButton: {
    width: 38,
    height: 38,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 12,
    backgroundColor: '#F2F5F0',
  },

  monthTitle: {
    fontSize: 17,
    fontWeight: '700',
    color: COLORS.green,
  },

  weekRow: {
    flexDirection: 'row',
    marginBottom: 8,
  },

  weekday: {
    width: `${100 / 7}%`,
    textAlign: 'center',
    fontSize: 11,
    fontWeight: '700',
    color: COLORS.muted,
  },

  calendarGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
  },

  dayCell: {
    width: `${100 / 7}%`,
    height: 58,
    alignItems: 'center',
    justifyContent: 'flex-start',
    paddingTop: 0,
    position: 'relative',
  },

  moodEmoji: {
    height: 16,
    fontSize: 12,
    lineHeight: 16,
    textAlign: 'center',
    marginBottom: 0,
  },

  moodEmojiPlaceholder: {
    height: 16,
  },

  dayCircle: {
    width: 32,
    height: 32,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
  },

  todayCircle: {
    borderWidth: 1,
    borderColor: COLORS.accent,
  },

  selectedDayCircle: {
    backgroundColor: COLORS.green,
  },

  dayNumber: {
    fontSize: 13,
    color: COLORS.text,
  },

  selectedDayNumber: {
    color: '#FFFFFF',
    fontWeight: '700',
  },

  dayDot: {
    position: 'absolute',
    bottom: 2,
    width: 4,
    height: 4,
    borderRadius: 2,
    backgroundColor: COLORS.accent,
  },

  calendarLegend: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    flexWrap: 'wrap',
    marginTop: 12,
    gap: 16,
  },

  legendItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },

  legendEmoji: {
    fontSize: 13,
  },

  legendDot: {
    width: 7,
    height: 7,
    borderRadius: 4,
    backgroundColor: COLORS.accent,
  },

  legendText: {
    fontSize: 11,
    color: COLORS.muted,
  },

  loader: {
    marginTop: 18,
  },

  errorMessage: {
    marginTop: 12,
    color: '#B64D49',
    fontSize: 13,
    lineHeight: 19,
  },

  moodCard: {
    marginTop: 16,
    backgroundColor: '#EAF0E9',
    borderRadius: 18,
    padding: 16,
  },

  moodCardTitle: {
    fontSize: 14,
    fontWeight: '700',
    color: COLORS.green,
  },

  moodRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 10,
  },

  selectedMoodEmoji: {
    fontSize: 28,
    marginRight: 10,
  },

  selectedMoodText: {
    fontSize: 15,
    fontWeight: '600',
    color: COLORS.text,
    textTransform: 'capitalize',
  },

  feelingsTitle: {
    marginTop: 14,
    marginBottom: 8,
    fontSize: 12,
    fontWeight: '700',
    color: COLORS.text,
  },

  feelingsRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },

  feelingChip: {
    backgroundColor: '#FFFFFF',
    borderRadius: 14,
    paddingHorizontal: 10,
    paddingVertical: 6,
  },

  feelingText: {
    fontSize: 12,
    color: COLORS.green,
    textTransform: 'capitalize',
  },

  checkinNoteTitle: {
    marginTop: 14,
    marginBottom: 7,
    fontSize: 12,
    fontWeight: '700',
    color: COLORS.text,
  },

  checkinNoteText: {
    fontSize: 13,
    lineHeight: 20,
    color: '#52665D',
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    padding: 12,
  },

  additionalCheckins: {
    marginTop: 12,
    fontSize: 11,
    lineHeight: 16,
    color: COLORS.muted,
  },

  previousSection: {
    marginTop: 25,
  },

  sectionTitle: {
    fontSize: 17,
    fontWeight: '700',
    color: COLORS.green,
    marginBottom: 12,
  },

  emptyCard: {
    backgroundColor: COLORS.card,
    borderRadius: 18,
    padding: 22,
    alignItems: 'center',
  },

  emptyTitle: {
    marginTop: 10,
    fontSize: 15,
    fontWeight: '700',
    color: COLORS.text,
    textAlign: 'center',
  },

  emptyText: {
    marginTop: 6,
    textAlign: 'center',
    fontSize: 12,
    lineHeight: 18,
    color: COLORS.muted,
  },

  futureDateCard: {
    marginTop: 25,
    backgroundColor: COLORS.card,
    borderRadius: 20,
    padding: 24,
    alignItems: 'center',
    elevation: 2,
  },

  entryCard: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    backgroundColor: COLORS.entry,
    borderRadius: 18,
    padding: 15,
    marginBottom: 10,
  },

  entryOpenArea: {
    flex: 1,
  },

  entryNumber: {
    fontSize: 11,
    fontWeight: '700',
    color: COLORS.accent,
    marginBottom: 5,
  },

  entryTitle: {
    fontSize: 15,
    fontWeight: '700',
    color: COLORS.green,
    marginBottom: 7,
  },

  entryText: {
    fontSize: 13,
    lineHeight: 20,
    color: '#52665D',
  },

  openHint: {
    fontSize: 11,
    color: COLORS.muted,
    marginTop: 9,
  },

  deleteButton: {
    padding: 9,
    marginLeft: 6,
  },

  journalCard: {
    marginTop: 25,
    backgroundColor: COLORS.card,
    borderRadius: 20,
    padding: 18,
    elevation: 2,
  },

  question: {
    fontSize: 16,
    fontWeight: '700',
    color: COLORS.text,
  },

  editorDate: {
    marginTop: 6,
    marginBottom: 18,
    fontSize: 12,
    color: COLORS.muted,
  },

  fieldLabel: {
    fontSize: 12,
    fontWeight: '700',
    color: COLORS.text,
    marginBottom: 8,
  },

  titleInput: {
    minHeight: 46,
    borderWidth: 1,
    borderColor: COLORS.border,
    borderRadius: 12,
    paddingHorizontal: 13,
    fontSize: 14,
    color: COLORS.green,
    backgroundColor: '#FAFBF9',
    marginBottom: 16,
  },

  input: {
    minHeight: 170,
    borderWidth: 1,
    borderColor: COLORS.border,
    borderRadius: 14,
    padding: 14,
    fontSize: 14,
    lineHeight: 21,
    color: COLORS.green,
    backgroundColor: '#FAFBF9',
  },

  saveButton: {
    marginTop: 15,
    backgroundColor: COLORS.green,
    borderRadius: 12,
    paddingVertical: 13,
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: 46,
  },

  disabledButton: {
    opacity: 0.65,
  },

  saveButtonText: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: '700',
  },

  cancelButton: {
    paddingVertical: 12,
    alignItems: 'center',
  },

  cancelButtonText: {
    color: COLORS.muted,
    fontSize: 13,
    fontWeight: '600',
  },

  message: {
    marginTop: 12,
    textAlign: 'center',
    fontSize: 13,
    fontWeight: '600',
    color: COLORS.accent,
  },
});
