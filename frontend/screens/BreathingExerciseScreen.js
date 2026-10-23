import React, { useEffect, useRef, useState } from 'react';

import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Animated,
} from 'react-native';


export default function BreathingExerciseScreen() {

  const [isRunning, setIsRunning] = useState(false);
  const [phase, setPhase] = useState('Ready');
  const [seconds, setSeconds] = useState(0);

  const circleSize = useRef(new Animated.Value(120)).current;

  const timerRef = useRef(null);
  const timeoutRef = useRef(null);


  useEffect(() => {

    if (!isRunning) {
      return;
    }


    const breathingCycle = () => {

      // INHALE
      setPhase('Inhale');

      Animated.timing(circleSize, {
        toValue: 220,
        duration: 4000,
        useNativeDriver: false,
      }).start(() => {

        if (!isRunning) {
          return;
        }


        // HOLD
        setPhase('Hold');

        timeoutRef.current = setTimeout(() => {

          if (!isRunning) {
            return;
          }


          // EXHALE
          setPhase('Exhale');

          Animated.timing(circleSize, {
            toValue: 120,
            duration: 6000,
            useNativeDriver: false,
          }).start(() => {

            if (!isRunning) {
              return;
            }

            // START NEXT CYCLE
            breathingCycle();

          });

        }, 4000);

      });

    };


    breathingCycle();


    // TIMER
    timerRef.current = setInterval(() => {

      setSeconds((previousSeconds) => previousSeconds + 1);

    }, 1000);


    return () => {

      clearInterval(timerRef.current);

      clearTimeout(timeoutRef.current);

    };

  }, [isRunning]);


  const handleStart = () => {

    setIsRunning(true);

  };


  const handlePause = () => {

    setIsRunning(false);

    circleSize.stopAnimation();

    clearTimeout(timeoutRef.current);

    clearInterval(timerRef.current);

    setPhase('Paused');

  };


  const handleReset = () => {

    setIsRunning(false);

    circleSize.stopAnimation();

    clearTimeout(timeoutRef.current);

    clearInterval(timerRef.current);

    circleSize.setValue(120);

    setPhase('Ready');

    setSeconds(0);

  };


  const formatTime = () => {

    const minutes = Math.floor(seconds / 60);

    const remainingSeconds = seconds % 60;

    return `${minutes}:${remainingSeconds
      .toString()
      .padStart(2, '0')}`;

  };


  return (
    <View style={styles.container}>

      <Text style={styles.title}>
        Breathing Exercise
      </Text>


      <Text style={styles.subtitle}>
        Follow the circle and focus on your breathing.
      </Text>


      <View style={styles.exerciseArea}>

        <Animated.View
          style={[
            styles.breathingCircle,
            {
              width: circleSize,
              height: circleSize,
              borderRadius: 110,
            },
          ]}
        >

          <Text style={styles.phaseText}>
            {phase}
          </Text>

        </Animated.View>

      </View>


      <Text style={styles.timer}>
        {formatTime()}
      </Text>


      <Text style={styles.instruction}>

        {phase === 'Inhale' && 'Breathe in slowly...'}

        {phase === 'Hold' && 'Hold your breath...'}

        {phase === 'Exhale' && 'Breathe out slowly...'}

        {phase === 'Ready' && 'Press Start when you are ready.'}

        {phase === 'Paused' && 'Exercise paused.'}

      </Text>


      <View style={styles.buttonRow}>

        {!isRunning ? (

          <TouchableOpacity
            style={styles.startButton}
            onPress={handleStart}
          >

            <Text style={styles.buttonText}>
              Start
            </Text>

          </TouchableOpacity>

        ) : (

          <TouchableOpacity
            style={styles.pauseButton}
            onPress={handlePause}
          >

            <Text style={styles.buttonText}>
              Pause
            </Text>

          </TouchableOpacity>

        )}


        <TouchableOpacity
          style={styles.resetButton}
          onPress={handleReset}
        >

          <Text style={styles.resetText}>
            Reset
          </Text>

        </TouchableOpacity>

      </View>

    </View>
  );
}


const styles = StyleSheet.create({

  container: {
    flex: 1,
    backgroundColor: '#F8F8F3',
    alignItems: 'center',
    paddingTop: 50,
    paddingHorizontal: 20,
  },

  title: {
    fontSize: 26,
    fontWeight: '700',
    color: '#304F4A',
  },

  subtitle: {
    marginTop: 8,
    fontSize: 13,
    color: '#89928E',
    textAlign: 'center',
  },

  exerciseArea: {
    height: 330,
    width: '100%',
    justifyContent: 'center',
    alignItems: 'center',
  },

  breathingCircle: {
    backgroundColor: '#C8DCC9',
    justifyContent: 'center',
    alignItems: 'center',
  },

  phaseText: {
    fontSize: 18,
    fontWeight: '700',
    color: '#304F4A',
  },

  timer: {
    fontSize: 24,
    fontWeight: '700',
    color: '#304F4A',
  },

  instruction: {
    marginTop: 8,
    fontSize: 14,
    color: '#6F7F77',
    textAlign: 'center',
  },

  buttonRow: {
    flexDirection: 'row',
    marginTop: 25,
    gap: 12,
  },

  startButton: {
    backgroundColor: '#304F4A',
    paddingHorizontal: 35,
    paddingVertical: 13,
    borderRadius: 12,
  },

  pauseButton: {
    backgroundColor: '#7FA88A',
    paddingHorizontal: 30,
    paddingVertical: 13,
    borderRadius: 12,
  },

  resetButton: {
    backgroundColor: '#E4E6E1',
    paddingHorizontal: 30,
    paddingVertical: 13,
    borderRadius: 12,
  },

  buttonText: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: '700',
  },

  resetText: {
    color: '#304F4A',
    fontSize: 14,
    fontWeight: '700',
  },

});