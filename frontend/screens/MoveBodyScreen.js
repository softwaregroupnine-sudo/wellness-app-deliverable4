// Move Your Body screen.
//
// Short, gentle, no-equipment movement routines. The student picks an
// energy level and the matching routines are listed first. Tapping a
// routine opens its steps. The AI can recommend this screen with the
// activity key "movement", and it is also listed in the Guidance tab.
// Nothing is saved to the database, so no new table is needed.
import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

// Energy levels the student can choose from.
const ENERGY_LEVELS = [
  { key: 'low', label: 'Low', emoji: '😴' },
  { key: 'okay', label: 'Okay', emoji: '🙂' },
  { key: 'high', label: 'High', emoji: '⚡' },
];

// Short, no-equipment routines. Intensity is deliberately gentle.
const ROUTINES = [
  {
    id: 'desk_reset',
    title: 'Desk Stretch Reset',
    duration: '2 min',
    icon: 'body-outline',
    bestFor: ['low', 'okay'],
    description:
      'Release tension after sitting and studying for a long time.',
    steps: [
      'Sit tall and slowly roll your shoulders back 5 times.',
      'Gently tilt your head to each side and hold for 15 seconds.',
      'Stretch each arm across your chest for 15 seconds.',
      'Open and close your hands 10 times, then circle your wrists.',
      'Stand up, reach both arms overhead and take 3 slow breaths.',
    ],
  },
  {
    id: 'walk',
    title: 'Walk It Out',
    duration: '5-10 min',
    icon: 'walk-outline',
    bestFor: ['low', 'okay', 'high'],
    description:
      'A short walk can help clear your head between study sessions.',
    steps: [
      'Step outside or walk around your room or building.',
      'Walk at a comfortable pace for 5 to 10 minutes.',
      'Leave your phone in your pocket and notice 3 things you can see, 2 you can hear and 1 you can feel.',
      'Slow down for the final minute and take a few deep breaths.',
    ],
  },
  {
    id: 'energiser',
    title: 'Quick Energiser',
    duration: '8 min',
    icon: 'flash-outline',
    bestFor: ['okay', 'high'],
    description:
      'Use your energy with a light, no-equipment circuit.',
    steps: [
      'March on the spot for 1 minute to warm up.',
      'Do 10 slow bodyweight squats.',
      'Do 8 wall push-ups (stand facing a wall and push away).',
      'Do 6 gentle lunges on each leg.',
      'Rest for 30 seconds, then repeat once if you feel good.',
      'Finish by stretching your legs and arms for 1 minute.',
    ],
  },
  {
    id: 'wind_down',
    title: 'Wind-Down Stretch',
    duration: '5 min',
    icon: 'moon-outline',
    bestFor: ['low'],
    description:
      'Slow stretches to ease stress, ideal in the evening.',
    steps: [
      'Sit or kneel and fold forward into a relaxed child\'s pose for 30 seconds.',
      'Move onto hands and knees and slowly arch and round your back 8 times.',
      'Sit with one leg straight and gently reach towards your toes for 20 seconds each side.',
      'Lie on your back, hug your knees and breathe slowly for 1 minute.',
    ],
  },
];

export default function MoveBodyScreen() {
  const insets = useSafeAreaInsets();

  // energy: chosen energy level (or null)
  // openId: routine whose steps are showing
  // completed: routines marked as done during this visit
  const [energy, setEnergy] = useState(null);
  const [openId, setOpenId] = useState(null);
  const [completed, setCompleted] = useState({});

  // Put routines that suit the chosen energy level first.
  const sortedRoutines = [...ROUTINES].sort((a, b) => {
    if (!energy) return 0;

    const aMatch = a.bestFor.includes(energy) ? 0 : 1;
    const bMatch = b.bestFor.includes(energy) ? 0 : 1;

    return aMatch - bMatch;
  });

  // Open or close the steps of one routine.
  const toggleRoutine = (id) => {
    setOpenId((current) => (current === id ? null : id));
  };

  // Mark a routine as done (kept in memory only).
  const markDone = (id) => {
    setCompleted((current) => ({ ...current, [id]: true }));
  };

  return (
    <View style={styles.container}>
      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={[
          styles.scrollContent,
          { paddingBottom: insets.bottom + 30 },
        ]}
      >
        <Text style={styles.heading}>Move your body</Text>

        <Text style={styles.subheading}>
          Short, gentle movement can help with stress, low energy and
          long study sessions. Pick what feels right today.
        </Text>

        {/* Energy selector */}
        <View style={styles.card}>
          <Text style={styles.cardTitle}>How is your energy?</Text>

          <View style={styles.energyRow}>
            {ENERGY_LEVELS.map((level) => {
              const isSelected = energy === level.key;

              return (
                <TouchableOpacity
                  key={level.key}
                  style={[
                    styles.energyChip,
                    isSelected && styles.energyChipSelected,
                  ]}
                  onPress={() =>
                    setEnergy(isSelected ? null : level.key)
                  }
                  activeOpacity={0.8}
                  accessibilityRole="button"
                  accessibilityState={{ selected: isSelected }}
                  accessibilityLabel={`${level.label} energy`}
                >
                  <Text style={styles.energyEmoji}>{level.emoji}</Text>

                  <Text
                    style={[
                      styles.energyLabel,
                      isSelected && styles.energyLabelSelected,
                    ]}
                  >
                    {level.label}
                  </Text>
                </TouchableOpacity>
              );
            })}
          </View>
        </View>

        {/* Routine list: each card expands to show its steps */}
        {sortedRoutines.map((routine) => {
          const isOpen = openId === routine.id;
          const isDone = !!completed[routine.id];
          const isSuggested =
            !!energy && routine.bestFor.includes(energy);

          return (
            <View key={routine.id} style={styles.routineCard}>
              <TouchableOpacity
                style={styles.routineHeader}
                onPress={() => toggleRoutine(routine.id)}
                activeOpacity={0.8}
                accessibilityRole="button"
                accessibilityState={{ expanded: isOpen }}
                accessibilityLabel={`${routine.title}, ${routine.duration}`}
              >
                <View style={styles.routineIcon}>
                  <Ionicons
                    name={routine.icon}
                    size={24}
                    color="#466B58"
                  />
                </View>

                <View style={styles.routineText}>
                  <View style={styles.titleRow}>
                    <Text style={styles.routineTitle}>
                      {routine.title}
                    </Text>

                    {isSuggested && (
                      <View style={styles.badge}>
                        <Text style={styles.badgeText}>
                          Suggested
                        </Text>
                      </View>
                    )}
                  </View>

                  <Text style={styles.routineMeta}>
                    {routine.duration}
                    {isDone ? '  ·  Done today ✓' : ''}
                  </Text>

                  <Text style={styles.routineDescription}>
                    {routine.description}
                  </Text>
                </View>

                <Ionicons
                  name={isOpen ? 'chevron-up' : 'chevron-down'}
                  size={20}
                  color="#87918C"
                />
              </TouchableOpacity>

              {isOpen && (
                <View style={styles.stepsContainer}>
                  {routine.steps.map((step, index) => (
                    <View key={index} style={styles.stepRow}>
                      <View style={styles.stepNumber}>
                        <Text style={styles.stepNumberText}>
                          {index + 1}
                        </Text>
                      </View>

                      <Text style={styles.stepText}>{step}</Text>
                    </View>
                  ))}

                  <TouchableOpacity
                    style={[
                      styles.doneButton,
                      isDone && styles.doneButtonDone,
                    ]}
                    onPress={() => markDone(routine.id)}
                    disabled={isDone}
                    activeOpacity={0.8}
                    accessibilityRole="button"
                    accessibilityLabel={
                      isDone ? 'Routine completed' : 'Mark routine as done'
                    }
                  >
                    <Text style={styles.doneButtonText}>
                      {isDone ? 'Nice work 🌿' : 'Mark as done'}
                    </Text>
                  </TouchableOpacity>
                </View>
              )}
            </View>
          );
        })}

        {/* Safety note */}
        <Text style={styles.disclaimer}>
          Move at your own pace and stop if anything hurts or feels
          wrong. This is general wellness guidance, not medical advice.
          If you have a health condition or injury, check with a
          healthcare professional first.
        </Text>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F8F8F3',
  },

  scrollContent: {
    paddingHorizontal: 22,
    paddingTop: 20,
  },

  heading: {
    fontSize: 24,
    fontWeight: '700',
    color: '#304F4A',
  },

  subheading: {
    fontSize: 13,
    lineHeight: 20,
    color: '#7B8583',
    marginTop: 6,
    marginBottom: 18,
  },

  card: {
    backgroundColor: '#FFFFFF',
    borderRadius: 18,
    padding: 16,
    borderWidth: 1,
    borderColor: '#ECEDE6',
    marginBottom: 14,
  },

  cardTitle: {
    fontSize: 15,
    fontWeight: '700',
    color: '#304F4A',
    marginBottom: 12,
  },

  energyRow: {
    flexDirection: 'row',
    gap: 10,
  },

  energyChip: {
    flex: 1,
    alignItems: 'center',
    paddingVertical: 12,
    borderRadius: 14,
    backgroundColor: '#F4F6F0',
    borderWidth: 1,
    borderColor: '#E4E6E1',
  },

  energyChipSelected: {
    backgroundColor: '#E1EDE2',
    borderColor: '#7FA88A',
  },

  energyEmoji: {
    fontSize: 22,
    marginBottom: 4,
  },

  energyLabel: {
    fontSize: 12,
    color: '#52635D',
  },

  energyLabelSelected: {
    fontWeight: '700',
    color: '#304F4A',
  },

  routineCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 17,
    borderWidth: 1,
    borderColor: '#ECEDE6',
    marginBottom: 11,
    overflow: 'hidden',
  },

  routineHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 15,
  },

  routineIcon: {
    width: 47,
    height: 47,
    borderRadius: 15,
    backgroundColor: '#E1EDE2',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 13,
  },

  routineText: {
    flex: 1,
    paddingRight: 8,
  },

  titleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    flexWrap: 'wrap',
    gap: 8,
  },

  routineTitle: {
    fontSize: 14,
    fontWeight: '700',
    color: '#304F4A',
  },

  badge: {
    backgroundColor: '#C8DCC9',
    borderRadius: 8,
    paddingHorizontal: 7,
    paddingVertical: 2,
  },

  badgeText: {
    fontSize: 10,
    fontWeight: '700',
    color: '#304F4A',
  },

  routineMeta: {
    fontSize: 11,
    color: '#466B58',
    marginTop: 3,
  },

  routineDescription: {
    fontSize: 11,
    lineHeight: 16,
    color: '#7B8583',
    marginTop: 4,
  },

  stepsContainer: {
    paddingHorizontal: 15,
    paddingBottom: 16,
    borderTopWidth: 1,
    borderTopColor: '#F0F1EB',
  },

  stepRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    marginTop: 12,
  },

  stepNumber: {
    width: 22,
    height: 22,
    borderRadius: 11,
    backgroundColor: '#E1EDE2',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 10,
    marginTop: 1,
  },

  stepNumberText: {
    fontSize: 11,
    fontWeight: '700',
    color: '#304F4A',
  },

  stepText: {
    flex: 1,
    fontSize: 13,
    lineHeight: 19,
    color: '#405B50',
  },

  doneButton: {
    marginTop: 18,
    backgroundColor: '#304F4A',
    borderRadius: 12,
    paddingVertical: 12,
    alignItems: 'center',
  },

  doneButtonDone: {
    backgroundColor: '#7FA88A',
  },

  doneButtonText: {
    fontSize: 14,
    fontWeight: '700',
    color: '#FFFFFF',
  },

  disclaimer: {
    fontSize: 11,
    lineHeight: 17,
    color: '#8A948D',
    textAlign: 'center',
    marginTop: 8,
    paddingHorizontal: 6,
  },
});