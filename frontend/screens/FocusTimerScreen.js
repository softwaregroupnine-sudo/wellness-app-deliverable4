import React, { useEffect, useRef, useState } from 'react';

import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Animated,
} from 'react-native';


export default function FocusTimerScreen() {

  const totalTime = 20 * 60;

  const [secondsLeft, setSecondsLeft] = useState(totalTime);
  const [isRunning, setIsRunning] = useState(false);
  const [isComplete, setIsComplete] = useState(false);

  const progress = useRef(new Animated.Value(0)).current;


  useEffect(() => {

    if (!isRunning) {
      return;
    }


    const timer = setInterval(() => {

      setSecondsLeft((previousSeconds) => {

        if (previousSeconds <= 1) {

          clearInterval(timer);

          setIsRunning(false);
          setIsComplete(true);

          Animated.timing(progress, {
            toValue: 1,
            duration: 300,
            useNativeDriver: false,
          }).start();

          return 0;
        }


        const newTime = previousSeconds - 1;

        const newProgress =
          (totalTime - newTime) / totalTime;


        Animated.timing(progress, {
          toValue: newProgress,
          duration: 900,
          useNativeDriver: false,
        }).start();


        return newTime;

      });

    }, 1000);


    return () => {
      clearInterval(timer);
    };

  }, [isRunning]);


  const handleStart = () => {

    if (isComplete) {
      return;
    }

    setIsRunning(true);

  };


  const handlePause = () => {

    setIsRunning(false);

  };


  const handleReset = () => {

    setIsRunning(false);
    setIsComplete(false);

    setSecondsLeft(totalTime);

    progress.setValue(0);

  };


  const formatTime = () => {

    const minutes = Math.floor(secondsLeft / 60);

    const seconds = secondsLeft % 60;

    return `${minutes}:${seconds
      .toString()
      .padStart(2, '0')}`;

  };


  const circleScale = progress.interpolate({
    inputRange: [0, 0.5, 1],
    outputRange: [1, 1.03, 1],
  });


  return (
    <View style={styles.container}>

      <Text style={styles.title}>
        Focus Timer
      </Text>


      <Text style={styles.subtitle}>
        Take some time to focus on one task.
      </Text>


      <View style={styles.timerArea}>

        <View style={styles.outerCircle}>

          <Animated.View
            style={[
              styles.progressCircle,
              {
                transform: [
                  {
                    scale: circleScale,
                  },
                ],
              },
            ]}
          >

            <Text style={styles.timerText}>
              {formatTime()}
            </Text>

            <Text style={styles.focusText}>
              {isComplete ? 'Complete!' : 'Focus'}
            </Text>

          </Animated.View>

        </View>

      </View>


      <Text style={styles.instruction}>

        {isComplete &&
          'Great job! Your focus session is complete.'}

        {!isComplete && !isRunning &&
          'Press Start when you are ready.'}

        {!isComplete && isRunning &&
          'Stay focused. You are doing great.'}

      </Text>


      <View style={styles.buttonRow}>

        {!isRunning && !isComplete && (

          <TouchableOpacity
            style={styles.startButton}
            onPress={handleStart}
          >

            <Text style={styles.buttonText}>
              Start
            </Text>

          </TouchableOpacity>

        )}


        {isRunning && (

          <TouchableOpacity
            style={styles.pauseButton}
            onPress={handlePause}
          >

            <Text style={styles.buttonText}>
              Pause
            </Text>

          </TouchableOpacity>

        )}


        {isComplete && (

          <TouchableOpacity
            style={styles.startButton}
            onPress={handleReset}
          >

            <Text style={styles.buttonText}>
              Start Again
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

  timerArea: {
    height: 350,
    width: '100%',
    justifyContent: 'center',
    alignItems: 'center',
  },

  outerCircle: {
    width: 260,
    height: 260,
    borderRadius: 130,
    borderWidth: 12,
    borderColor: '#DCE6DC',
    justifyContent: 'center',
    alignItems: 'center',
  },

  progressCircle: {
    width: 230,
    height: 230,
    borderRadius: 115,
    backgroundColor: '#C8DCC9',
    justifyContent: 'center',
    alignItems: 'center',
  },

  timerText: {
    fontSize: 42,
    fontWeight: '700',
    color: '#304F4A',
  },

  focusText: {
    marginTop: 5,
    fontSize: 16,
    fontWeight: '600',
    color: '#55756D',
  },

  instruction: {
    fontSize: 14,
    color: '#6F7F77',
    textAlign: 'center',
    minHeight: 40,
  },

  buttonRow: {
    flexDirection: 'row',
    marginTop: 25,
    gap: 12,
  },

  startButton: {
    backgroundColor: '#304F4A',
    paddingHorizontal: 30,
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