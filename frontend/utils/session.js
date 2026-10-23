// Saved login session.
//
// After a successful login the user object returned by the API is kept
// on the phone with AsyncStorage, so the student does not have to log in
// again every time the app is reopened. Logging out removes it.
//
// Only the user details already returned by /login are stored (id,
// participant_id, email, display_name). The password is never saved.
import AsyncStorage from '@react-native-async-storage/async-storage';

const SESSION_KEY = 'wellness_session_user';

// Save the logged-in user.
export async function saveSession(user) {
  try {
    await AsyncStorage.setItem(SESSION_KEY, JSON.stringify(user));
  } catch (error) {
    // The app still works if saving fails; the user logs in next time.
    console.error('Could not save the login session:', error);
  }
}

// Return the saved user, or null if nobody is logged in.
export async function loadSession() {
  try {
    const saved = await AsyncStorage.getItem(SESSION_KEY);

    if (!saved) return null;

    const user = JSON.parse(saved);

    // Ignore anything that does not look like a valid user.
    return user && typeof user.participant_id === 'string'
      ? user
      : null;
  } catch (error) {
    console.error('Could not load the login session:', error);
    return null;
  }
}

// Remove the saved user (used when logging out).
export async function clearSession() {
  try {
    await AsyncStorage.removeItem(SESSION_KEY);
  } catch (error) {
    console.error('Could not clear the login session:', error);
  }
}