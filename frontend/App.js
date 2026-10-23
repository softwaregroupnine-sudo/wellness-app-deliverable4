import React from 'react';

import { SafeAreaProvider } from 'react-native-safe-area-context';

import { NavigationContainer } from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { Ionicons } from '@expo/vector-icons';

import LoginScreen from './screens/LoginScreen';
import RegisterScreen from './screens/RegisterScreen';
import DashboardScreen from './screens/DashboardScreen';
import MoodCheckinScreen from './screens/MoodCheckinScreen';
import AIAnalysisScreen from './screens/AIAnalysisScreen';
import GuidanceScreen from './screens/GuidanceScreen';
import SettingsScreen from './screens/SettingsScreen';
import BreathingExerciseScreen from './screens/BreathingExerciseScreen';
import FocusTimerScreen from './screens/FocusTimerScreen';
import GratitudeJournalScreen from './screens/GratitudeJournalScreen';
import WrittenAssessmentScreen from './screens/WrittenAssessmentScreen';
import MoveBodyScreen from './screens/MoveBodyScreen';
import AIChatScreen from './screens/AIChatScreen';
import ProfileScreen from './screens/ProfileScreen';
import NotificationsScreen from './screens/NotificationsScreen';
import SleepBetterScreen from './screens/SleepBetterScreen';

const Stack = createNativeStackNavigator();
const Tab = createBottomTabNavigator();

function MainApp({ route }) {
  const user = route.params?.user;

  const tabIcons = {
    Dashboard: {
      active: 'home',
      inactive: 'home-outline',
      color: '#4F8065',
    },
    'Check-in': {
      active: 'happy',
      inactive: 'happy-outline',
      color: '#8B72B5',
    },
    'AI Analysis': {
      active: 'analytics',
      inactive: 'analytics-outline',
      color: '#8B72B5',
    },
    Guidance: {
      active: 'leaf',
      inactive: 'leaf-outline',
      color: '#4F8065',
    },
    More: {
      active: 'grid',
      inactive: 'grid-outline',
      color: '#4F8065',
    },
  };

  return (
    <Tab.Navigator
      screenOptions={({ route }) => {
        const tab = tabIcons[route.name];

        return {
          headerShown: false,

          tabBarActiveTintColor: tab.color,
          tabBarInactiveTintColor: '#8A858B',

          tabBarLabelStyle: {
            fontSize: 10,
            fontWeight: '600',
            marginBottom: 4,
            textAlign: 'center',
          },

          tabBarIcon: ({ focused, color, size }) => (
            <Ionicons
              name={focused ? tab.active : tab.inactive}
              size={size}
              color={color}
            />
          ),

          tabBarItemStyle: {
            paddingHorizontal: 2,
          },

          tabBarStyle: {
            backgroundColor: '#FFFFFF',
            borderTopColor: '#E8E2E8',
            borderTopWidth: 1,
            height: 66,
            paddingTop: 6,
            paddingBottom: 5,
            paddingHorizontal: 10,
            elevation: 8,
          },
        };
      }}
    >
      <Tab.Screen
        name="Dashboard"
        component={DashboardScreen}
        initialParams={{ user }}
      />

      <Tab.Screen
        name="Check-in"
        component={MoodCheckinScreen}
        initialParams={{ user }}
      />

      <Tab.Screen
        name="AI Analysis"
        component={AIAnalysisScreen}
        initialParams={{ user }}
      />

      <Tab.Screen
        name="Guidance"
        component={GuidanceScreen}
        initialParams={{ user }}
      />

      <Tab.Screen
        name="More"
        component={SettingsScreen}
        initialParams={{ user }}
      />
    </Tab.Navigator>
  );
}

export default function App() {
  return (
    <SafeAreaProvider>
      <NavigationContainer>
        <Stack.Navigator>
          <Stack.Screen
            name="Login"
            component={LoginScreen}
            options={{
              headerShown: false,
            }}
          />

          <Stack.Screen
            name="Register"
            component={RegisterScreen}
          />

          <Stack.Screen
            name="MainApp"
            component={MainApp}
            options={{
              headerShown: false,
            }}
          />

          <Stack.Screen
            name="SleepBetter"
            component={SleepBetterScreen}
            options={{
              title: 'Sleep Better',
              headerTintColor: '#31504F',
              headerStyle: {
                backgroundColor: '#F5EFF0',
              },
              headerShadowVisible: false,
            }}
          />

          <Stack.Screen
            name="BreathingExercise"
            component={BreathingExerciseScreen}
            options={{
              title: 'Breathing Exercise',
            }}
          />

          <Stack.Screen
            name="FocusTimer"
            component={FocusTimerScreen}
            options={{
              title: 'Focus Timer',
            }}
          />

          <Stack.Screen
            name="GratitudeJournal"
            component={GratitudeJournalScreen}
            options={{
              title: 'Gratitude Journal',
            }}
          />

          <Stack.Screen
            name="MoveBody"
            component={MoveBodyScreen}
            options={{
              title: 'Move Your Body',
            }}
          />

          <Stack.Screen
            name="WrittenAssessment"
            component={WrittenAssessmentScreen}
            options={{
              title: 'Written Assessment',
            }}
          />

          <Stack.Screen
            name="AIChat"
            component={AIChatScreen}
            options={{
              headerShown: false,
            }}
          />

          <Stack.Screen
            name="Profile"
            component={ProfileScreen}
            options={{
              headerShown: false,
            }}
          />

          <Stack.Screen
            name="Notifications"
            component={NotificationsScreen}
            options={{
              headerShown: false,
            }}
          />
        </Stack.Navigator>
      </NavigationContainer>
    </SafeAreaProvider>
  );
}