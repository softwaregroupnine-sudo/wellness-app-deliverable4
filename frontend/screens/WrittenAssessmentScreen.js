import React, { useCallback, useRef, useState } from 'react';

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
  submitAssessment,
  getAssessments,
  updateAssessment,
  deleteAssessment,
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
  chip: '#E1EDE2',
  danger: '#B64D49',
};

const MIN_LENGTH = 10;
const MAX_LENGTH = 2000;

// SQLite stores CURRENT_TIMESTAMP in UTC as "YYYY-MM-DD HH:MM:SS".
function formatDateTime(value) {
  if (!value) return '';

  const text = String(value);
  const iso = /Z$|[+-]\d{2}:\d{2}$/.test(text)
    ? text
    : `${text.replace(' ', 'T')}Z`;

  const date = new Date(iso);

  if (Number.isNaN(date.getTime())) return '';

  return date.toLocaleString('en-ZA', {
    day: 'numeric',
    month: 'short',
    hour: '2-digit',
    minute: '2-digit',
  });
}

function getEntriesFromResponse(response) {
  if (Array.isArray(response)) return response;
  if (Array.isArray(response?.assessments)) return response.assessments;

  return [];
}

export default function WrittenAssessmentScreen({ route }) {
  const user = route?.params?.user || {};
  const participantId = user.participant_id;

  const scrollRef = useRef(null);

  const [text, setText] = useState('');
  const [editing, setEditing] = useState(null);
  const [items, setItems] = useState([]);
  const [result, setResult] = useState(null);

  const [loading, setLoading] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [errorMessage, setErrorMessage] = useState('');

  // READ: load this student's saved assessments.
  const loadItems = useCallback(async () => {
    if (!participantId) {
      setItems([]);
      setErrorMessage(
        'Your account could not be identified. Please log in again.'
      );
      return;
    }

    try {
      setLoading(true);

      const response = await getAssessments(participantId);
      setItems(getEntriesFromResponse(response));
    } catch (error) {
      setErrorMessage(
        error.message || 'Could not load your assessments.'
      );
    } finally {
      setLoading(false);
    }
  }, [participantId]);

  useFocusEffect(
    useCallback(() => {
      loadItems();
    }, [loadItems])
  );

  const cancelEdit = () => {
    setEditing(null);
    setText('');
    setErrorMessage('');
  };

  // CREATE or UPDATE, depending on whether an entry is being edited.
  const handleSubmit = async () => {
    const trimmed = text.trim();

    if (!participantId) {
      setErrorMessage(
        'Your account could not be identified. Please log in again.'
      );
      return;
    }

    if (trimmed.length < MIN_LENGTH) {
      setErrorMessage(
        `Please write a little more (at least ${MIN_LENGTH} characters) so the guidance can be useful.`
      );
      return;
    }

    try {
      setSubmitting(true);
      setErrorMessage('');
      setResult(null);

      const saved = editing
        ? await updateAssessment(participantId, editing.id, trimmed)
        : await submitAssessment(participantId, trimmed);

      setResult({
        emotion: saved.emotional_label,
        guidance: saved.guidance,
        wasEdit: Boolean(editing),
      });

      setText('');
      setEditing(null);

      await loadItems();
    } catch (error) {
      setErrorMessage(
        error.message ||
          'Could not analyse your assessment. Please try again.'
      );
    } finally {
      setSubmitting(false);
    }
  };

  const startEdit = (item) => {
    setEditing(item);
    setText(item.text_input || '');
    setResult(null);
    setErrorMessage('');

    scrollRef.current?.scrollTo({ y: 0, animated: true });
  };

  // DELETE: ask first, then remove and refresh the list.
  const confirmDelete = (item) => {
    Alert.alert(
      'Delete assessment',
      'Are you sure you want to delete this assessment? This cannot be undone.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: async () => {
            try {
              setErrorMessage('');

              await deleteAssessment(participantId, item.id);

              if (editing?.id === item.id) {
                cancelEdit();
              }

              await loadItems();
            } catch (error) {
              setErrorMessage(
                error.message || 'Could not delete this assessment.'
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
        ref={scrollRef}
        style={styles.container}
        contentContainerStyle={styles.content}
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
      >
        <Text style={styles.title}>Written Assessment</Text>

        <Text style={styles.subtitle}>
          Describe how you are feeling in your own words and receive
          general wellness guidance.
        </Text>

        {/* Input card */}
        <View style={styles.inputCard}>
          <Text style={styles.question}>
            {editing ? 'Edit your assessment' : 'How are you feeling?'}
          </Text>

          <TextInput
            style={styles.input}
            placeholder="For example: I have three deadlines this week and I can't switch off at night..."
            placeholderTextColor="#A3ADA7"
            value={text}
            onChangeText={(value) => {
              setText(value);
              setErrorMessage('');
            }}
            multiline
            textAlignVertical="top"
            maxLength={MAX_LENGTH}
            editable={!submitting}
            accessibilityLabel="Describe how you are feeling"
          />

          <Text style={styles.counter}>
            {text.length}/{MAX_LENGTH}
          </Text>

          {!!errorMessage && (
            <Text style={styles.errorMessage}>{errorMessage}</Text>
          )}

          <TouchableOpacity
            style={[
              styles.submitButton,
              submitting && styles.disabledButton,
            ]}
            onPress={handleSubmit}
            disabled={submitting}
            activeOpacity={0.8}
            accessibilityRole="button"
          >
            {submitting ? (
              <ActivityIndicator color="#FFFFFF" />
            ) : (
              <Text style={styles.submitButtonText}>
                {editing ? 'Update assessment' : 'Get guidance'}
              </Text>
            )}
          </TouchableOpacity>

          {editing && (
            <TouchableOpacity
              style={styles.cancelButton}
              onPress={cancelEdit}
              disabled={submitting}
            >
              <Text style={styles.cancelButtonText}>
                Cancel editing
              </Text>
            </TouchableOpacity>
          )}
        </View>

        {/* Result of the latest submission */}
        {result && (
          <View style={styles.resultCard}>
            <Text style={styles.resultHeading}>
              {result.wasEdit ? 'Updated guidance' : 'Your guidance'}
            </Text>

            <View style={styles.chip}>
              <Text style={styles.chipText}>{result.emotion}</Text>
            </View>

            <Text style={styles.resultText}>{result.guidance}</Text>
          </View>
        )}

        {/* History */}
        <Text style={styles.sectionTitle}>Your previous assessments</Text>

        {loading && items.length === 0 && (
          <ActivityIndicator
            style={styles.loader}
            size="small"
            color={COLORS.green}
          />
        )}

        {!loading && items.length === 0 && (
          <View style={styles.emptyCard}>
            <Ionicons
              name="create-outline"
              size={27}
              color={COLORS.accent}
            />

            <Text style={styles.emptyTitle}>No assessments yet</Text>

            <Text style={styles.emptyText}>
              Write about how you feel above and your assessments
              will appear here.
            </Text>
          </View>
        )}

        {items.map((item) => (
          <View key={String(item.id)} style={styles.entryCard}>
            <View style={styles.entryHeader}>
              <Text style={styles.entryDate}>
                {formatDateTime(item.submitted_at)}
              </Text>

              <View style={styles.chip}>
                <Text style={styles.chipText}>
                  {item.emotional_label &&
                  item.emotional_label !== 'unavailable'
                    ? item.emotional_label
                    : 'Unavailable'}
                </Text>
              </View>
            </View>

            <Text style={styles.entryText} numberOfLines={4}>
              {item.text_input}
            </Text>

            {!!item.guidance && (
              <Text style={styles.entryGuidance}>{item.guidance}</Text>
            )}

            <View style={styles.entryActions}>
              <TouchableOpacity
                style={styles.actionButton}
                onPress={() => startEdit(item)}
                accessibilityRole="button"
                accessibilityLabel="Edit assessment"
              >
                <Ionicons
                  name="create-outline"
                  size={18}
                  color={COLORS.green}
                />
                <Text style={styles.actionText}>Edit</Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={styles.actionButton}
                onPress={() => confirmDelete(item)}
                accessibilityRole="button"
                accessibilityLabel="Delete assessment"
              >
                <Ionicons
                  name="trash-outline"
                  size={18}
                  color={COLORS.danger}
                />
                <Text
                  style={[styles.actionText, { color: COLORS.danger }]}
                >
                  Delete
                </Text>
              </TouchableOpacity>
            </View>
          </View>
        ))}

        <Text style={styles.disclaimer}>
          This guidance is general wellness support, not a diagnosis.
          If you are in immediate danger, call 112.
        </Text>
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

  inputCard: {
    marginTop: 23,
    backgroundColor: COLORS.card,
    borderRadius: 20,
    padding: 18,
    elevation: 2,
  },

  question: {
    fontSize: 16,
    fontWeight: '700',
    color: COLORS.text,
    marginBottom: 12,
  },

  input: {
    minHeight: 150,
    borderWidth: 1,
    borderColor: COLORS.border,
    borderRadius: 14,
    padding: 14,
    fontSize: 14,
    lineHeight: 21,
    color: COLORS.green,
    backgroundColor: '#FAFBF9',
  },

  counter: {
    alignSelf: 'flex-end',
    marginTop: 6,
    fontSize: 11,
    color: COLORS.muted,
  },

  errorMessage: {
    marginTop: 8,
    color: COLORS.danger,
    fontSize: 13,
    lineHeight: 19,
  },

  submitButton: {
    marginTop: 14,
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

  submitButtonText: {
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

  resultCard: {
    marginTop: 16,
    backgroundColor: '#EAF0E9',
    borderRadius: 18,
    padding: 16,
  },

  resultHeading: {
    fontSize: 14,
    fontWeight: '700',
    color: COLORS.green,
    marginBottom: 10,
  },

  resultText: {
    marginTop: 12,
    fontSize: 13,
    lineHeight: 20,
    color: '#52665D',
  },

  chip: {
    alignSelf: 'flex-start',
    backgroundColor: COLORS.chip,
    borderRadius: 14,
    paddingHorizontal: 12,
    paddingVertical: 5,
  },

  chipText: {
    fontSize: 12,
    fontWeight: '700',
    color: COLORS.green,
    textTransform: 'capitalize',
  },

  sectionTitle: {
    marginTop: 28,
    marginBottom: 12,
    fontSize: 17,
    fontWeight: '700',
    color: COLORS.green,
  },

  loader: {
    marginTop: 12,
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
  },

  emptyText: {
    marginTop: 6,
    textAlign: 'center',
    fontSize: 12,
    lineHeight: 18,
    color: COLORS.muted,
  },

  entryCard: {
    backgroundColor: COLORS.entry,
    borderRadius: 18,
    padding: 15,
    marginBottom: 10,
  },

  entryHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 10,
  },

  entryDate: {
    fontSize: 11,
    fontWeight: '700',
    color: COLORS.accent,
  },

  entryText: {
    fontSize: 13,
    lineHeight: 20,
    color: '#52665D',
  },

  entryGuidance: {
    marginTop: 10,
    paddingTop: 10,
    borderTopWidth: 1,
    borderTopColor: COLORS.border,
    fontSize: 12,
    lineHeight: 19,
    color: COLORS.muted,
  },

  entryActions: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    gap: 18,
    marginTop: 12,
  },

  actionButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingVertical: 4,
  },

  actionText: {
    fontSize: 13,
    fontWeight: '600',
    color: COLORS.green,
  },

  disclaimer: {
    marginTop: 20,
    textAlign: 'center',
    fontSize: 11,
    lineHeight: 17,
    color: COLORS.muted,
    paddingHorizontal: 10,
  },
});