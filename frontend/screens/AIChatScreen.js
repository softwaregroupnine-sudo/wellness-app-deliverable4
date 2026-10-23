
import Markdown from 'react-native-markdown-display';
import React, { useEffect, useRef, useState } from 'react';

import {
  View,
  Text,
  StyleSheet,
  TextInput,
  TouchableOpacity,
  ScrollView,
  ActivityIndicator,
  Alert,
  Modal,
  FlatList,
  KeyboardAvoidingView,
  Platform,
} from 'react-native';

import { useSafeAreaInsets } from 'react-native-safe-area-context';

import {
  sendWellnessMessage,
  getWellnessConversations,
  getWellnessChatHistory,
  deleteWellnessConversation,
} from '../services/api';

export default function AIChatScreen({ navigation, route }) {
  const insets = useSafeAreaInsets();

  const [message, setMessage] = useState('');
  const [messages, setMessages] = useState([]);
  const [conversationId, setConversationId] = useState(null);
  const [loading, setLoading] = useState(false);
  const [historyLoading, setHistoryLoading] = useState(false);
  const [historyVisible, setHistoryVisible] = useState(false);
  const [conversations, setConversations] = useState([]);

  const scrollViewRef = useRef(null);

  // Find the logged-in user passed from LoginScreen.
  const findUser = () => {
    if (route?.params?.user) {
      return route.params.user;
    }

    let parent = navigation;

    while (parent) {
      const state = parent.getState?.();

      if (state?.routes) {
        for (const item of state.routes) {
          if (item.name === 'MainApp' && item.params?.user) {
            return item.params.user;
          }
        }
      }

      parent = parent.getParent?.();
    }

    return null;
  };

  const user = findUser();

  const participantId =
    user?.participant_id ??
    user?.participantId ??
    null;

  useEffect(() => {
    navigation.setOptions?.({
      headerShown: false,
    });
  }, [navigation]);

  const scrollToBottom = () => {
    setTimeout(() => {
      scrollViewRef.current?.scrollToEnd({ animated: true });
    }, 100);
  };

  const startNewChat = () => {
    setConversationId(null);
    setMessages([]);
    setMessage('');
    setHistoryVisible(false);
  };

  const handleSend = async () => {
    const question = message.trim();

    if (!question || loading) {
      return;
    }

    if (!participantId) {
      Alert.alert(
        'User not found',
        'Your logged-in user ID could not be found. Please check the user data returned by the login API.'
      );
      return;
    }

    const userMessage = {
      id: `user-${Date.now()}`,
      role: 'user',
      content: question,
    };

    setMessages(previous => [...previous, userMessage]);
    setMessage('');
    setLoading(true);
    scrollToBottom();

    try {
      const result = await sendWellnessMessage(
        participantId,
        question,
        conversationId
      );

      if (result.conversation_id != null) {
        setConversationId(result.conversation_id);
      }

      setMessages(previous => [
        ...previous,
        {
          id: `ai-${Date.now()}`,
          role: 'assistant',
          content:
            result.response_text ||
            result.response ||
            "I couldn't generate a response. Please try again.",
        },
      ]);
    } catch (error) {
      Alert.alert('Message failed', error.message);

      // Remove the temporary user message if the request failed.
      setMessages(previous =>
        previous.filter(item => item.id !== userMessage.id)
      );

      setMessage(question);
    } finally {
      setLoading(false);
      scrollToBottom();
    }
  };

  const openHistory = async () => {
    if (!participantId) {
      Alert.alert('User not found', 'Please log in again.');
      return;
    }

    setHistoryVisible(true);
    setHistoryLoading(true);

    try {
      const result = await getWellnessConversations(participantId);

      const list = Array.isArray(result)
        ? result
        : result.conversations || result.chats || result.data || [];

      setConversations(list);
    } catch (error) {
      Alert.alert('History unavailable', error.message);
    } finally {
      setHistoryLoading(false);
    }
  };

  const openConversation = async item => {
    const id = item.id ?? item.conversation_id;

    if (id == null) {
      Alert.alert('Unable to open', 'This conversation has no ID.');
      return;
    }

    setHistoryLoading(true);

    try {
      const result = await getWellnessChatHistory(
        participantId,
        id
      );

      const rows = Array.isArray(result)
        ? result
        : result.messages || result.chats || result.data || [];

      const loadedMessages = [];

      rows.forEach((row, index) => {
        // The backend stores each exchange as a question and response.
        const question =
          row.question_text ?? row.question ?? null;

        const answer =
          row.response_text ?? row.response ?? null;

        if (question) {
          loadedMessages.push({
            id: `history-user-${row.id ?? index}`,
            role: 'user',
            content: question,
          });
        }

        if (answer) {
          loadedMessages.push({
            id: `history-ai-${row.id ?? index}`,
            role: 'assistant',
            content: answer,
          });
        }
      });

      setConversationId(id);
      setMessages(loadedMessages);
      setHistoryVisible(false);
      scrollToBottom();
    } catch (error) {
      Alert.alert('Could not open conversation', error.message);
    } finally {
      setHistoryLoading(false);
    }
  };

  const handleDeleteConversation = item => {
    const id = item.id ?? item.conversation_id;

    Alert.alert(
      'Delete conversation',
      'Are you sure you want to delete this conversation?',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: async () => {
            try {
              await deleteWellnessConversation(participantId, id);

              setConversations(previous =>
                previous.filter(
                  conversation =>
                    (conversation.id ?? conversation.conversation_id) !== id
                )
              );

              if (conversationId === id) {
                startNewChat();
              }
            } catch (error) {
              Alert.alert('Delete failed', error.message);
            }
          },
        },
      ]
    );
  };

  const renderConversation = ({ item }) => (
    <View style={styles.historyItem}>
      <TouchableOpacity
        style={styles.historyItemContent}
        onPress={() => openConversation(item)}
      >
        <Text style={styles.historyItemTitle} numberOfLines={2}>
          {item.title ||
            item.last_question ||
            'Wellness conversation'}
        </Text>

        <Text style={styles.historyItemDate}>
          {item.updated_at || item.created_at || ''}
        </Text>
      </TouchableOpacity>

      <TouchableOpacity
        onPress={() => handleDeleteConversation(item)}
        style={styles.deleteButton}
      >
        <Text style={styles.deleteButtonText}>×</Text>
      </TouchableOpacity>
    </View>
  );

  return (
    <KeyboardAvoidingView
      style={styles.container}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      keyboardVerticalOffset={Platform.OS === 'ios' ? 20 : 0}
    >
      <View
        style={[
          styles.header,
          { paddingTop: insets.top + 8 },
        ]}
      >
        <TouchableOpacity
          onPress={() => navigation.goBack()}
          accessibilityRole="button"
          accessibilityLabel="Go back"
        >
          <Text style={styles.backButton}>‹</Text>
        </TouchableOpacity>

        <View style={styles.headerTitleContainer}>
          <Text style={styles.sparkle}>✦</Text>
          <Text style={styles.headerTitle}>AI Assistant</Text>
        </View>

        <TouchableOpacity
          onPress={openHistory}
          accessibilityRole="button"
          accessibilityLabel="Open conversation history"
        >
          <Text style={styles.historyButton}>History</Text>
        </TouchableOpacity>
      </View>

      <ScrollView
        ref={scrollViewRef}
        style={styles.chat}
        showsVerticalScrollIndicator={false}
        contentContainerStyle={styles.chatContent}
        keyboardShouldPersistTaps="handled"
        onContentSizeChange={scrollToBottom}
      >
        {messages.length === 0 && (
          <View style={styles.welcomeContainer}>
            <View style={styles.aiCircle}>
              <Text style={styles.robot}>🤖</Text>
            </View>

            <Text style={styles.welcomeTitle}>
              Hi! I'm here to help.
            </Text>

            <Text style={styles.welcomeText}>
              You can ask me about your wellbeing, mood, or things you're
              experiencing.
            </Text>

            <TouchableOpacity
              style={styles.newChatSuggestion}
              onPress={() =>
                setMessage('Why have I been feeling tired lately?')
              }
            >
              <Text style={styles.suggestionText}>
                Why have I been feeling tired lately?
              </Text>
            </TouchableOpacity>
          </View>
        )}

        {messages.map(item => (
          <View
            key={item.id}
            style={
              item.role === 'user'
                ? styles.userMessage
                : styles.aiMessage
            }
          >
            {item.role === 'user' ? (
              <Text style={styles.userMessageText}>
                {item.content}
              </Text>
            ) : (
              <Markdown style={markdownStyles}>
                {item.content}
              </Markdown>
            )}
          </View>
        ))}

        {loading && (
          <View style={styles.loadingMessage}>
            <ActivityIndicator size="small" color="#654571" />
            <Text style={styles.loadingText}>
              Thinking...
            </Text>
          </View>
        )}
      </ScrollView>

      <View style={styles.inputArea}>
        <View style={styles.inputContainer}>
          <Text style={styles.inputSparkle}>✦</Text>

          <TextInput
            style={styles.input}
            placeholder="Ask something..."
            placeholderTextColor="#8C8490"
            value={message}
            onChangeText={setMessage}
            editable={!loading}
            multiline
            maxLength={3000}
            onSubmitEditing={handleSend}
            blurOnSubmit
          />
        </View>

        <TouchableOpacity
          style={[
            styles.sendButton,
            (loading || !message.trim()) && styles.sendButtonDisabled,
          ]}
          onPress={handleSend}
          disabled={loading || !message.trim()}
        >
          {loading ? (
            <ActivityIndicator size="small" color="#FFFFFF" />
          ) : (
            <Text style={styles.sendIcon}>➤</Text>
          )}
        </TouchableOpacity>
      </View>

      <Modal
        visible={historyVisible}
        animationType="slide"
        transparent
        onRequestClose={() => setHistoryVisible(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.historyModal}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>
                Conversation History
              </Text>

              <TouchableOpacity
                onPress={() => setHistoryVisible(false)}
              >
                <Text style={styles.closeButton}>×</Text>
              </TouchableOpacity>
            </View>

            <TouchableOpacity
              style={styles.startNewButton}
              onPress={startNewChat}
            >
              <Text style={styles.startNewButtonText}>
                + New conversation
              </Text>
            </TouchableOpacity>

            {historyLoading ? (
              <ActivityIndicator
                size="large"
                color="#654571"
                style={styles.historyLoader}
              />
            ) : (
              <FlatList
                data={conversations}
                keyExtractor={(item, index) =>
                  String(item.id ?? item.conversation_id ?? index)
                }
                renderItem={renderConversation}
                ListEmptyComponent={
                  <Text style={styles.emptyHistory}>
                    No saved conversations yet.
                  </Text>
                }
              />
            )}
          </View>
        </View>
      </Modal>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#DDD5D6',
  },

  header: {
    minHeight: 60,
    paddingHorizontal: 18,
    paddingBottom: 12,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: '#DDD5D6',
  },

  backButton: {
    fontSize: 38,
    color: '#4D315C',
    lineHeight: 38,
  },

  headerTitleContainer: {
    flexDirection: 'row',
    alignItems: 'center',
  },

  sparkle: {
    fontSize: 20,
    color: '#654571',
    marginRight: 6,
  },

  headerTitle: {
  fontSize: 24,
  fontWeight: '700',
  color: '#4D315C',
},

  historyButton: {
    fontSize: 13,
    fontWeight: '600',
    color: '#654571',
  },

  chat: {
    flex: 1,
  },

  chatContent: {
    padding: 20,
    paddingBottom: 20,
    flexGrow: 1,
  },

  welcomeContainer: {
    alignItems: 'center',
    marginTop: 20,
    marginBottom: 30,
  },

  aiCircle: {
    width: 64,
    height: 64,
    borderRadius: 32,
    backgroundColor: '#E9DDF0',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 12,
  },

  robot: {
    fontSize: 30,
  },

  welcomeTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: '#4D315C',
    marginBottom: 7,
  },

  welcomeText: {
    textAlign: 'center',
    color: '#665E68',
    fontSize: 13,
    lineHeight: 19,
    paddingHorizontal: 25,
  },

  newChatSuggestion: {
    backgroundColor: '#F4EEF5',
    borderRadius: 18,
    padding: 12,
    marginTop: 20,
  },

  suggestionText: {
    color: '#654571',
    fontSize: 13,
  },

  userMessage: {
    alignSelf: 'flex-end',
    maxWidth: '85%',
    backgroundColor: '#654571',
    borderRadius: 18,
    borderBottomRightRadius: 5,
    paddingHorizontal: 15,
    paddingVertical: 11,
    marginBottom: 12,
  },

  userMessageText: {
    color: '#FFFFFF',
    fontSize: 13,
    lineHeight: 19,
  },

  aiMessage: {
    alignSelf: 'flex-start',
    maxWidth: '88%',
    backgroundColor: '#F4EEF5',
    borderRadius: 18,
    borderBottomLeftRadius: 5,
    paddingHorizontal: 15,
    paddingVertical: 11,
    marginBottom: 12,
  },

  loadingMessage: {
    alignSelf: 'flex-start',
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#F4EEF5',
    borderRadius: 18,
    paddingHorizontal: 15,
    paddingVertical: 11,
    marginBottom: 12,
  },

  loadingText: {
    color: '#654571',
    fontSize: 13,
    marginLeft: 8,
  },

  inputArea: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 15,
    paddingVertical: 12,
    backgroundColor: '#DDD5D6',
  },

  inputContainer: {
    flex: 1,
    minHeight: 48,
    maxHeight: 110,
    backgroundColor: '#F4EEF5',
    borderRadius: 24,
    flexDirection: 'row',
    alignItems: 'center',
    paddingLeft: 15,
    marginRight: 8,
  },

  inputSparkle: {
    fontSize: 16,
    color: '#765582',
    marginRight: 5,
  },

  input: {
    flex: 1,
    minHeight: 48,
    maxHeight: 100,
    color: '#4D4650',
    fontSize: 13,
    paddingVertical: 12,
    paddingRight: 10,
  },

  sendButton: {
    width: 46,
    height: 46,
    borderRadius: 23,
    backgroundColor: '#5A3B68',
    alignItems: 'center',
    justifyContent: 'center',
  },

  sendButtonDisabled: {
    opacity: 0.6,
  },

  sendIcon: {
    color: '#FFFFFF',
    fontSize: 18,
    marginLeft: 2,
  },

  modalOverlay: {
    flex: 1,
    justifyContent: 'flex-end',
    backgroundColor: 'rgba(40, 25, 45, 0.35)',
  },

  historyModal: {
    height: '75%',
    backgroundColor: '#F4EEF5',
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    paddingHorizontal: 20,
    paddingTop: 20,
    paddingBottom: 25,
  },

  modalHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 18,
  },

  modalTitle: {
    color: '#4D315C',
    fontSize: 19,
    fontWeight: '700',
  },

  closeButton: {
    fontSize: 30,
    color: '#654571',
    paddingHorizontal: 8,
  },

  startNewButton: {
    backgroundColor: '#654571',
    padding: 13,
    borderRadius: 14,
    alignItems: 'center',
    marginBottom: 12,
  },

  startNewButtonText: {
    color: '#FFFFFF',
    fontWeight: '600',
  },

  historyItem: {
    flexDirection: 'row',
    alignItems: 'center',
    borderBottomWidth: 1,
    borderBottomColor: '#E2D8E5',
  },

  historyItemContent: {
    flex: 1,
    paddingVertical: 15,
  },

  historyItemTitle: {
    color: '#4D315C',
    fontSize: 14,
    fontWeight: '600',
  },

  historyItemDate: {
    color: '#8C8490',
    fontSize: 11,
    marginTop: 5,
  },

  deleteButton: {
    padding: 10,
  },

  deleteButtonText: {
    fontSize: 24,
    color: '#8C5260',
  },

  historyLoader: {
    marginTop: 30,
  },

  emptyHistory: {
    textAlign: 'center',
    color: '#756B79',
    marginTop: 30,
    fontSize: 14,
  },
});

// Styling for formatted AI responses.
const markdownStyles = {
  body: {
    color: '#5D5660',
    fontSize: 13,
    lineHeight: 20,
  },

  paragraph: {
    marginTop: 0,
    marginBottom: 8,
  },

  heading1: {
    color: '#4D315C',
    fontSize: 19,
    fontWeight: '700',
    marginTop: 8,
    marginBottom: 6,
  },

  heading2: {
    color: '#4D315C',
    fontSize: 16,
    fontWeight: '700',
    marginTop: 7,
    marginBottom: 5,
  },

  heading3: {
    color: '#654571',
    fontSize: 14,
    fontWeight: '700',
    marginTop: 6,
    marginBottom: 4,
  },

  strong: {
    fontWeight: '700',
    color: '#4D315C',
  },

  em: {
    fontStyle: 'italic',
  },

  bullet_list: {
    marginTop: 3,
    marginBottom: 6,
  },

  ordered_list: {
    marginTop: 3,
    marginBottom: 6,
  },

  list_item: {
    marginBottom: 3,
  },

  blockquote: {
    backgroundColor: '#E9DDF0',
    borderLeftColor: '#654571',
    borderLeftWidth: 3,
    paddingHorizontal: 10,
    paddingVertical: 4,
  },

  code_inline: {
    backgroundColor: '#E9DDF0',
    color: '#4D315C',
    fontSize: 12,
  },

  code_block: {
    backgroundColor: '#E9DDF0',
    color: '#4D315C',
    padding: 10,
    borderRadius: 8,
  },

  link: {
    color: '#654571',
    textDecorationLine: 'underline',
  },

  hr: {
    backgroundColor: '#DDD5D6',
    height: 1,
    marginVertical: 8,
  },
};
