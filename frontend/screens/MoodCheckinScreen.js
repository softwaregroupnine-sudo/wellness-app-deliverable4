import React, { useEffect, useState } from 'react';

import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  TextInput,
  ScrollView,
  Alert,
  ActivityIndicator,
} from 'react-native';

import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { saveMoodCheckin } from '../services/api';

export default function MoodCheckinScreen({ navigation, route }) {
  const insets = useSafeAreaInsets();
  const user = route.params?.user;

  const [selectedMood, setSelectedMood] = useState(
    route.params?.selectedMood || null
  );

  const [note, setNote] = useState('');

  const [selectedFeelings, setSelectedFeelings] = useState([]);

  // New optional check-in fields.
  const [stressLevel, setStressLevel] = useState(null);
  const [sleepQuality, setSleepQuality] = useState(null);
  const [mainConcern, setMainConcern] = useState(null);

  const [saved, setSaved] = useState(false);
  const [saving, setSaving] = useState(false);

  // Update the selected mood whenever the Dashboard passes a new one.
  useEffect(() => {
    const moodFromDashboard = route.params?.selectedMood;

    if (moodFromDashboard) {
      setSelectedMood(moodFromDashboard);
      setSaved(false);
    }
  }, [route.params?.selectedMood]);

  const moods = [
    { name: 'Awful', emoji: '😞' },
    { name: 'Not Great', emoji: '😕' },
    { name: 'Okay', emoji: '😐' },
    { name: 'Good', emoji: '🙂' },
    { name: 'Amazing', emoji: '😄' },
  ];

  const feelings = [
    'Stressed',
    'Tired',
    'Motivated',
    'Anxious',
    'Calm',
  ];

  const stressOptions = ['Low', 'Moderate', 'High'];

  const sleepOptions = ['Poor', 'Fair', 'Good'];

  const concernOptions = [
    'Academic workload',
    'Personal concerns',
    'Social relationships',
    'Health and sleep',
    'No particular concern',
    'Other',
  ];

  const toggleFeeling = feeling => {
    setSaved(false);

    if (selectedFeelings.includes(feeling)) {
      setSelectedFeelings(
        selectedFeelings.filter(item => item !== feeling)
      );
    } else {
      setSelectedFeelings([
        ...selectedFeelings,
        feeling,
      ]);
    }
  };

  const saveCheckin = async () => {
    if (saving) return;

    const participantId = user?.participant_id;

    if (!participantId) {
      Alert.alert(
        'Account information missing',
        'Your account information could not be found. Please log out and log in again.'
      );
      return;
    }

    if (!selectedMood) {
      Alert.alert(
        'Choose a mood',
        'Please select how you are feeling before saving.'
      );
      return;
    }

    setSaving(true);
    setSaved(false);

    try {
      await saveMoodCheckin(
        participantId,
        selectedMood,
        selectedFeelings,
        note,
        stressLevel,
        sleepQuality,
        mainConcern
      );

      setSaved(true);
    } catch (error) {
      Alert.alert(
        'Could not save check-in',
        error.message || 'Please check your connection and try again.'
      );
    } finally {
      setSaving(false);
    }
  };

  // Reusable option chip for the optional questions.
  const renderOption = (
    option,
    selectedValue,
    onSelect,
    keyPrefix = ''
  ) => {
    const isSelected = selectedValue === option;

    return (
      <TouchableOpacity
        key={`${keyPrefix}${option}`}
        style={[
          styles.optionChip,
          isSelected && styles.selectedOptionChip,
        ]}
        onPress={() => {
          onSelect(isSelected ? null : option);
          setSaved(false);
        }}
        activeOpacity={0.75}
        accessibilityRole="button"
        accessibilityLabel={option}
        accessibilityState={{ selected: isSelected }}
      >
        <Text
          style={[
            styles.optionText,
            isSelected && styles.selectedOptionText,
          ]}
        >
          {option}
        </Text>

        {isSelected && (
          <View style={styles.checkCircle}>
            <Text style={styles.checkText}>✓</Text>
          </View>
        )}
      </TouchableOpacity>
    );
  };

  return (
    <View style={styles.container}>
      <View
        pointerEvents="none"
        style={styles.backgroundBlob}
      />

      <View
        style={[
          styles.decorativeLeaf,
          { top: insets.top + 45 },
        ]}
        pointerEvents="none"
      >
        <Text style={styles.leafDecoration}>🌿</Text>
      </View>

      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={[
          styles.scrollContent,
          { paddingTop: insets.top + 12 },
        ]}
        keyboardShouldPersistTaps="handled"
      >
        {/* HEADER */}
        <View style={styles.header}>
          <View style={styles.headerLeft}>
            <Text style={styles.leafIcon}>🍃</Text>
            <Text style={styles.headerTitle}>Mood Check-in</Text>
          </View>
        </View>

        {/* INTRODUCTION */}
        <View style={styles.headingSection}>
          <Text style={styles.mainHeading}>
            How are you feeling today?
          </Text>

          <Text style={styles.subtitle}>
            Take a moment to check in with yourself.
          </Text>

          <Text style={styles.sectionHeading}>
            Mood Check-in
          </Text>
        </View>

        {/* MOOD SELECTION */}
        <View style={styles.moodOptions}>
          {moods.map(mood => {
            const isSelected = selectedMood === mood.name;

            return (
              <TouchableOpacity
                key={mood.name}
                style={[
                  styles.moodCard,
                  isSelected && styles.selectedMoodCard,
                ]}
                onPress={() => {
                  setSelectedMood(mood.name);
                  setSaved(false);
                }}
                activeOpacity={0.75}
                accessibilityRole="button"
                accessibilityLabel={`Select ${mood.name} mood`}
                accessibilityState={{ selected: isSelected }}
              >
                <Text style={styles.moodEmoji}>
                  {mood.emoji}
                </Text>

                <Text
                  style={[
                    styles.moodLabel,
                    isSelected && styles.selectedMoodLabel,
                  ]}
                >
                  {mood.name}
                </Text>
              </TouchableOpacity>
            );
          })}
        </View>

        {/* NOTE */}
        <View style={styles.noteSection}>
          <Text style={styles.noteLabel}>
            Add a note (optional)
          </Text>

          <TextInput
            style={styles.noteInput}
            placeholder="How was your day? Anything on your mind?"
            placeholderTextColor="#8B7896"
            value={note}
            onChangeText={text => {
              setNote(text);
              setSaved(false);
            }}
            multiline
            textAlignVertical="top"
            maxLength={300}
            accessibilityLabel="Optional check-in note"
          />

          <Text style={styles.characterCount}>
            {note.length}/300
          </Text>
        </View>

        {/* FEELINGS */}
        <View style={styles.feelingsSection}>
          <Text style={styles.feelingsLabel}>
            What are you feeling? (Select any that apply)
          </Text>

          <View style={styles.feelingsRow}>
            {feelings.map(feeling => {
              const isSelected = selectedFeelings.includes(feeling);

              return (
                <TouchableOpacity
                  key={feeling}
                  style={[
                    styles.feelingChip,
                    isSelected && styles.selectedFeelingChip,
                  ]}
                  onPress={() => toggleFeeling(feeling)}
                  activeOpacity={0.75}
                  accessibilityRole="button"
                  accessibilityLabel={feeling}
                  accessibilityState={{ selected: isSelected }}
                >
                  <Text
                    style={[
                      styles.feelingText,
                      isSelected && styles.selectedFeelingText,
                    ]}
                  >
                    {feeling}
                  </Text>

                  {isSelected && (
                    <View style={styles.checkCircle}>
                      <Text style={styles.checkText}>✓</Text>
                    </View>
                  )}
                </TouchableOpacity>
              );
            })}
          </View>
        </View>

        {/* OPTIONAL WELLNESS QUESTIONS */}
        <View style={styles.optionalSection}>
          <View style={styles.optionalHeadingRow}>
            <Text style={styles.optionalSectionTitle}>
              A little more about your day
            </Text>

            <View style={styles.optionalBadge}>
              <Text style={styles.optionalBadgeText}>
                OPTIONAL
              </Text>
            </View>
          </View>

          <Text style={styles.optionalDescription}>
            These extra questions can help personalise your wellness
            insights. Answer whichever questions you feel comfortable
            answering, or skip them.
          </Text>

          {/* STRESS LEVEL */}
          <View style={styles.questionCard}>
            <Text style={styles.questionTitle}>
              1. How would you describe your stress level?
            </Text>

            <Text style={styles.questionHint}>
              Choose one, or leave unanswered.
            </Text>

            <View style={styles.optionsWrap}>
              {stressOptions.map(option =>
                renderOption(
                  option,
                  stressLevel,
                  setStressLevel,
                  'stress-'
                )
              )}
            </View>
          </View>

          {/* SLEEP QUALITY */}
          <View style={styles.questionCard}>
            <Text style={styles.questionTitle}>
              2. How has your sleep been?
            </Text>

            <Text style={styles.questionHint}>
              Think about your recent sleep quality.
            </Text>

            <View style={styles.optionsWrap}>
              {sleepOptions.map(option =>
                renderOption(
                  option,
                  sleepQuality,
                  setSleepQuality,
                  'sleep-'
                )
              )}
            </View>
          </View>

          {/* MAIN CONCERN */}
          <View style={styles.questionCard}>
            <Text style={styles.questionTitle}>
              3. What has been your main concern today?
            </Text>

            <Text style={styles.questionHint}>
              Choose the option that best describes your day.
            </Text>

            <View style={styles.optionsWrap}>
              {concernOptions.map(option =>
                renderOption(
                  option,
                  mainConcern,
                  setMainConcern,
                  'concern-'
                )
              )}
            </View>
          </View>

          <Text style={styles.privacyHint}>
            Your answers are used alongside your check-in to help
            personalise your wellness insights. You can leave any
            question unanswered.
          </Text>
        </View>

        {/* SAVE BUTTON */}
        <TouchableOpacity
          style={[
            styles.saveButton,
            saving && styles.saveButtonDisabled,
          ]}
          onPress={saveCheckin}
          disabled={saving || !selectedMood}
          activeOpacity={0.8}
          accessibilityRole="button"
        >
          {saving ? (
            <View style={styles.savingContent}>
              <ActivityIndicator
                size="small"
                color="#D8C5EA"
              />

              <Text style={styles.saveButtonText}>
                Saving...
              </Text>
            </View>
          ) : (
            <Text style={styles.saveButtonText}>
              Save Check-in
            </Text>
          )}
        </TouchableOpacity>

        {/* SUCCESS MESSAGE */}
        {saved && (
          <View style={styles.confirmation}>
            <Text style={styles.confirmationText}>
              ✓ Check-in saved successfully
            </Text>
          </View>
        )}
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
    paddingBottom: 30,
  },

  backgroundBlob: {
    position: 'absolute',
    top: -80,
    right: -80,
    width: 330,
    height: 210,
    backgroundColor: '#EBCDD6',
    borderBottomLeftRadius: 180,
    borderBottomRightRadius: 100,
    borderTopLeftRadius: 160,
  },

  decorativeLeaf: {
    position: 'absolute',
    right: -5,
    opacity: 0.45,
  },

  leafDecoration: {
    fontSize: 70,
    transform: [{ rotate: '25deg' }],
  },

  header: {
    marginHorizontal: 20,
  },

  headerLeft: {
    flexDirection: 'row',
    alignItems: 'center',
  },

  leafIcon: {
    fontSize: 22,
    marginRight: 7,
  },

  // Standard main screen title.
  headerTitle: {
    fontSize: 24,
    fontWeight: '700',
    color: '#3F4B49',
  },

  headingSection: {
    marginTop: 25,
    alignItems: 'center',
    paddingHorizontal: 20,
  },

  mainHeading: {
    fontSize: 25,
    fontWeight: '800',
    color: '#4A2E6B',
    textAlign: 'center',
  },

  subtitle: {
    marginTop: 7,
    fontSize: 13,
    color: '#65536D',
    textAlign: 'center',
  },

  sectionHeading: {
    marginTop: 15,
    fontSize: 17,
    fontWeight: '800',
    color: '#4A2E6B',
    textAlign: 'center',
  },

  // MOOD OPTIONS
  moodOptions: {
    marginTop: 18,
    marginHorizontal: 20,
    flexDirection: 'row',
    justifyContent: 'space-between',
  },

  moodCard: {
    width: 58,
    height: 82,
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    justifyContent: 'center',
    alignItems: 'center',
    elevation: 2,
    shadowOpacity: 0.08,
    shadowRadius: 4,
    shadowOffset: {
      width: 0,
      height: 2,
    },
  },

  selectedMoodCard: {
    borderWidth: 2,
    borderColor: '#4A2E6B',
  },

  moodEmoji: {
    fontSize: 26,
    marginBottom: 7,
  },

  moodLabel: {
    fontSize: 9,
    color: '#655D67',
    textAlign: 'center',
  },

  selectedMoodLabel: {
    color: '#4A2E6B',
    fontWeight: '700',
  },

  // NOTE
  noteSection: {
    marginTop: 18,
    marginHorizontal: 20,
    height: 125,
    backgroundColor: '#CFC1E1',
    borderRadius: 15,
    padding: 13,
  },

  noteLabel: {
    fontSize: 12,
    fontWeight: '700',
    color: '#4A2E6B',
  },

  noteInput: {
    flex: 1,
    marginTop: 5,
    padding: 0,
    fontSize: 12,
    color: '#4A3C50',
  },

  characterCount: {
    position: 'absolute',
    right: 12,
    bottom: 9,
    fontSize: 10,
    color: '#6D587B',
  },

  // FEELINGS
  feelingsSection: {
    marginTop: 15,
    marginHorizontal: 20,
  },

  feelingsLabel: {
    fontSize: 12,
    fontWeight: '700',
    color: '#4A2E6B',
    marginBottom: 10,
  },

  feelingsRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    flexWrap: 'wrap',
    gap: 8,
  },

  feelingChip: {
    minHeight: 32,
    paddingHorizontal: 8,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: '#74558E',
    backgroundColor: '#FFFFFF',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
  },

  selectedFeelingChip: {
    backgroundColor: '#D7CBE7',
    borderWidth: 0,
  },

  feelingText: {
    fontSize: 9,
    color: '#4A2E6B',
  },

  selectedFeelingText: {
    fontWeight: '600',
  },

  checkCircle: {
    width: 14,
    height: 14,
    borderRadius: 7,
    backgroundColor: '#7B5A9B',
    marginLeft: 4,
    alignItems: 'center',
    justifyContent: 'center',
  },

  checkText: {
    fontSize: 9,
    fontWeight: '800',
    color: '#FFFFFF',
  },

  // OPTIONAL QUESTIONS
  optionalSection: {
    marginTop: 24,
    marginHorizontal: 20,
  },

  optionalHeadingRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    flexWrap: 'wrap',
    gap: 8,
  },

  optionalSectionTitle: {
    flex: 1,
    fontSize: 17,
    fontWeight: '800',
    color: '#4A2E6B',
  },

  optionalBadge: {
    paddingHorizontal: 9,
    paddingVertical: 5,
    borderRadius: 10,
    backgroundColor: '#CFC1E1',
  },

  optionalBadgeText: {
    fontSize: 9,
    fontWeight: '800',
    letterSpacing: 0.6,
    color: '#4A2E6B',
  },

  optionalDescription: {
    marginTop: 8,
    marginBottom: 14,
    fontSize: 12,
    lineHeight: 18,
    color: '#65536D',
  },

  questionCard: {
    marginBottom: 12,
    padding: 14,
    backgroundColor: '#F7F2F5',
    borderRadius: 15,
    borderWidth: 1,
    borderColor: '#D8C9D9',
  },

  questionTitle: {
    fontSize: 13,
    fontWeight: '700',
    lineHeight: 19,
    color: '#4A2E6B',
  },

  questionHint: {
    marginTop: 4,
    marginBottom: 12,
    fontSize: 11,
    lineHeight: 16,
    color: '#786B7C',
  },

  optionsWrap: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },

  optionChip: {
    minHeight: 36,
    paddingHorizontal: 12,
    paddingVertical: 9,
    borderRadius: 18,
    borderWidth: 1,
    borderColor: '#A38CB5',
    backgroundColor: '#FFFFFF',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
  },

  selectedOptionChip: {
    backgroundColor: '#D7CBE7',
    borderColor: '#7B5A9B',
  },

  optionText: {
    fontSize: 11,
    color: '#4A2E6B',
  },

  selectedOptionText: {
    fontWeight: '700',
  },

  privacyHint: {
    marginTop: 2,
    marginBottom: 4,
    fontSize: 11,
    lineHeight: 17,
    color: '#65536D',
  },

  // SAVE BUTTON
  saveButton: {
    marginTop: 18,
    marginHorizontal: 16,
    height: 48,
    borderRadius: 14,
    backgroundColor: '#4A2E6B',
    alignItems: 'center',
    justifyContent: 'center',
  },

  saveButtonDisabled: {
    opacity: 0.7,
  },

  savingContent: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
  },

  saveButtonText: {
    fontSize: 14,
    fontWeight: '800',
    color: '#D8C5EA',
  },

  // SUCCESS MESSAGE
  confirmation: {
    marginTop: 8,
    alignItems: 'center',
  },

  confirmationText: {
    fontSize: 12,
    fontWeight: '600',
    color: '#4A2E6B',
  },
});