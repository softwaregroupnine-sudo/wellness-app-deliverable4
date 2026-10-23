import Constants from 'expo-constants';

const hostUri = Constants.expoConfig?.hostUri;
const host = hostUri?.split(':')[0];

if (!host) {
  throw new Error(
    'Could not detect the development server IP. Start Expo in LAN mode.'
  );
}

const API_BASE_URL = 'https://unicycle-backpack-finalist.ngrok-free.dev';

async function handleResponse(response, fallbackMessage) {
  let data;

  try {
    data = await response.json();
  } catch {
    throw new Error(fallbackMessage);
  }

  if (!response.ok) {
    throw new Error(data.error || data.message || fallbackMessage);
  }

  return data;
}

// --------------------------------------------------
// LOGIN
// --------------------------------------------------

export async function loginUser(email, password) {
  const response = await fetch(`${API_BASE_URL}/login`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      email: email.trim(),
      password,
    }),
  });

  return handleResponse(response, 'Login failed. Please try again.');
}

// --------------------------------------------------
// REGISTER
// --------------------------------------------------

export async function registerUser(displayName, email, password) {
  const response = await fetch(`${API_BASE_URL}/register`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      display_name: displayName.trim(),
      email: email.trim(),
      password,
    }),
  });

  return handleResponse(
    response,
    'Registration failed. Please try again.'
  );
}

// --------------------------------------------------
// SAVE MOOD CHECK-IN
// Includes optional stress, sleep and main concern fields.
// --------------------------------------------------

export async function saveMoodCheckin(
  participantId,
  moodValue,
  feelings,
  note,
  stressLevel = null,
  sleepQuality = null,
  mainConcern = null
) {
  const response = await fetch(`${API_BASE_URL}/checkins`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      participant_id: participantId,
      mood_value: moodValue,
      feelings,
      note: (note || '').trim(),
      stress_level: stressLevel,
      sleep_quality: sleepQuality,
      main_concern: mainConcern,
    }),
  });

  return handleResponse(
    response,
    'Could not save your check-in. Please try again.'
  );
}

// --------------------------------------------------
// LOAD MOOD TRENDS
// --------------------------------------------------

export async function getMoodTrends(participantId) {
  const response = await fetch(
    `${API_BASE_URL}/checkins/trends?participant_id=${encodeURIComponent(
      participantId
    )}`
  );

  return handleResponse(
    response,
    'Could not load your mood trends.'
  );
}

// --------------------------------------------------
// LOAD PERSONALIZED GUIDANCE RECOMMENDATIONS
// --------------------------------------------------

export async function getGuidanceRecommendations(participantId) {
  const response = await fetch(
    `${API_BASE_URL}/guidance/recommendations?participant_id=${encodeURIComponent(
      participantId
    )}`
  );

  return handleResponse(
    response,
    'Could not load your guidance recommendations. Please try again.'
  );
}

// --------------------------------------------------
// GENERATE AI WELLNESS ANALYSIS
// --------------------------------------------------

export async function generateWellnessAnalysis(participantId) {
  const response = await fetch(`${API_BASE_URL}/wellness-analysis`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      participant_id: participantId,
    }),
  });

  return handleResponse(
    response,
    'Could not generate your wellness analysis. Please try again.'
  );
}

// --------------------------------------------------
// LOAD SAVED AI WELLNESS RECOMMENDATIONS FOR DASHBOARD
// Does not generate a new analysis.
// --------------------------------------------------

export async function getSavedWellnessRecommendations(participantId) {
  if (!participantId) {
    throw new Error('A participant ID is required to load recommendations.');
  }

  const response = await fetch(
    `${API_BASE_URL}/wellness-analysis/recommendations?participant_id=${encodeURIComponent(
      participantId
    )}`
  );

  return handleResponse(
    response,
    'Could not load your recommended activities. Please try again.'
  );
}


// --------------------------------------------------
// SEND A MESSAGE TO THE AI
// If conversationId is null, the backend creates a new conversation.
// --------------------------------------------------

export async function sendWellnessMessage(
  participantId,
  questionText,
  conversationId = null
) {
  const body = {
    participant_id: participantId,
    question_text: questionText.trim(),
  };

  if (conversationId !== null) {
    body.conversation_id = conversationId;
  }

  const response = await fetch(`${API_BASE_URL}/wellness-chats`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(body),
  });

  return handleResponse(
    response,
    'Could not send your message. Please try again.'
  );
}

// --------------------------------------------------
// LOAD THE USER'S CONVERSATION LIST
// --------------------------------------------------

export async function getWellnessConversations(participantId) {
  const response = await fetch(
    `${API_BASE_URL}/wellness-conversations?participant_id=${encodeURIComponent(
      participantId
    )}`
  );

  return handleResponse(
    response,
    'Could not load your conversations.'
  );
}

// --------------------------------------------------
// LOAD MESSAGES FROM ONE CONVERSATION
// --------------------------------------------------

export async function getWellnessChatHistory(
  participantId,
  conversationId
) {
  const response = await fetch(
    `${API_BASE_URL}/wellness-chats?participant_id=${encodeURIComponent(
      participantId
    )}&conversation_id=${encodeURIComponent(conversationId)}`
  );

  return handleResponse(
    response,
    'Could not load this conversation.'
  );
}

// --------------------------------------------------
// DELETE A CONVERSATION AND ITS MESSAGES
// --------------------------------------------------

export async function deleteWellnessConversation(
  participantId,
  conversationId
) {
  const response = await fetch(
    `${API_BASE_URL}/wellness-conversations/${encodeURIComponent(
      conversationId
    )}?participant_id=${encodeURIComponent(participantId)}`,
    {
      method: 'DELETE',
    }
  );

  return handleResponse(
    response,
    'Could not delete this conversation.'
  );
}

// --------------------------------------------------
// JOURNAL ENTRIES
// --------------------------------------------------

// SAVE A JOURNAL ENTRY

export async function saveJournalEntry(
  participantId,
  title,
  content,
  entryDate
) {
  const response = await fetch(`${API_BASE_URL}/journal-entries`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      participant_id: participantId,
      title: (title || '').trim() || null,
      content: content.trim(),
      ...(entryDate ? { entry_date: entryDate } : {}),
    }),
  });

  return handleResponse(
    response,
    'Could not save your journal entry. Please try again.'
  );
}

// LOAD JOURNAL ENTRIES
// Optionally load entries for a specific date or month.

export async function getJournalEntries(
  participantId,
  entryDate = null,
  month = null
) {
  const params = new URLSearchParams({
    participant_id: participantId,
  });

  if (entryDate) {
    params.append('entry_date', entryDate);
  } else if (month) {
    params.append('month', month);
  }

  const response = await fetch(
    `${API_BASE_URL}/journal-entries?${params.toString()}`
  );

  return handleResponse(
    response,
    'Could not load your journal entries.'
  );
}

// LOAD ONE JOURNAL ENTRY

export async function getJournalEntry(participantId, entryId) {
  const params = new URLSearchParams({
    participant_id: participantId,
  });

  const response = await fetch(
    `${API_BASE_URL}/journal-entries/${encodeURIComponent(
      entryId
    )}?${params.toString()}`
  );

  return handleResponse(
    response,
    'Could not load this journal entry.'
  );
}

// UPDATE A JOURNAL ENTRY

export async function updateJournalEntry(
  participantId,
  entryId,
  title,
  content,
  entryDate
) {
  const response = await fetch(
    `${API_BASE_URL}/journal-entries/${encodeURIComponent(entryId)}`,
    {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        participant_id: participantId,
        title: (title || '').trim() || null,
        content: content.trim(),
        entry_date: entryDate,
      }),
    }
  );

  return handleResponse(
    response,
    'Could not update your journal entry.'
  );
}

// DELETE A JOURNAL ENTRY

export async function deleteJournalEntry(participantId, entryId) {
  const response = await fetch(
    `${API_BASE_URL}/journal-entries/${encodeURIComponent(
      entryId
    )}?participant_id=${encodeURIComponent(participantId)}`,
    {
      method: 'DELETE',
    }
  );

  return handleResponse(
    response,
    'Could not delete your journal entry.'
  );
}

export const getMoodCheckins = async (participantId) => {
  if (!participantId) {
    throw new Error('A participant ID is required to load mood check-ins.');
  }

  const response = await fetch(
    `${API_BASE_URL}/checkins?participant_id=${encodeURIComponent(
      participantId
    )}`
  );

  return handleResponse(
    response,
    'Failed to load mood check-ins.'
  );
};
// --------------------------------------------------
// WRITTEN ASSESSMENTS (create, read, update, delete)
// --------------------------------------------------

export async function submitAssessment(participantId, textInput) {
  const response = await fetch(`${API_BASE_URL}/assessments`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      participant_id: participantId,
      text_input: textInput,
    }),
  });

  return handleResponse(
    response,
    'Could not analyse your assessment. Please try again.'
  );
}

export async function getAssessments(participantId) {
  const response = await fetch(
    `${API_BASE_URL}/assessments?participant_id=${encodeURIComponent(
      participantId
    )}`
  );

  return handleResponse(response, 'Could not load your assessments.');
}

export async function updateAssessment(
  participantId,
  assessmentId,
  textInput
) {
  const response = await fetch(
    `${API_BASE_URL}/assessments/${encodeURIComponent(assessmentId)}`,
    {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        participant_id: participantId,
        text_input: textInput,
      }),
    }
  );

  return handleResponse(response, 'Could not update your assessment.');
}

export async function deleteAssessment(participantId, assessmentId) {
  const response = await fetch(
    `${API_BASE_URL}/assessments/${encodeURIComponent(
      assessmentId
    )}?participant_id=${encodeURIComponent(participantId)}`,
    { method: 'DELETE' }
  );

  return handleResponse(response, 'Could not delete your assessment.');
}

// --------------------------------------------------
// FORGOT PASSWORD (sends a reset link by email)
// --------------------------------------------------

export async function requestPasswordReset(email) {
  const response = await fetch(`${API_BASE_URL}/forgot-password`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email: email.trim() }),
  });

  return handleResponse(
    response,
    'Could not send the reset email. Please try again.'
  );
}