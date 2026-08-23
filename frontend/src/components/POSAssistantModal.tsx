import React, { useState, useEffect, useRef } from 'react';
import {
  View,
  StyleSheet,
  Modal,
  TouchableOpacity,
  ScrollView,
  TextInput,
  Animated,
  Platform,
  Dimensions,
  ActivityIndicator,
} from 'react-native';
import { Text, Surface, useTheme, Chip, IconButton, Button } from 'react-native-paper';
import Icon from 'react-native-vector-icons/MaterialCommunityIcons';
import { router } from 'expo-router';
import { useAppTheme } from '../providers/ThemeProvider';
import {
  processPOSConversation,
  POSIntentResult,
  SpeechService,
} from '../lib/conversational_ai';
import { DS } from '../constants/designTokens';

export interface POSAssistantModalProps {
  visible: boolean;
  onClose: () => void;
  products?: any[];
  onAddToCart?: (product: any, qty: number) => void;
  onClearCart?: () => void;
  onApplyDiscount?: (discount: { type: 'percent' | 'flat'; value: number }) => void;
  onCheckout?: (method: string) => void;
  contextData?: {
    todaySales?: number;
    todayBills?: number;
    cartItems?: any[];
  };
}

interface MessageItem {
  id: string;
  sender: 'user' | 'assistant';
  text: string;
  timestamp: string;
  intentResult?: POSIntentResult;
}

export default function POSAssistantModal({
  visible,
  onClose,
  products = [],
  onAddToCart,
  onClearCart,
  onApplyDiscount,
  onCheckout,
  contextData,
}: POSAssistantModalProps) {
  const { isDarkMode } = useAppTheme();
  const theme = useTheme();

  const [inputVal, setInputVal] = useState('');
  const [messages, setMessages] = useState<MessageItem[]>([
    {
      id: 'init-1',
      sender: 'assistant',
      text: "👋 Hi! I'm your BharatPOS AI Assistant. How can I help you today? You can speak or type your request.",
      timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
    },
  ]);
  const [isListening, setIsListening] = useState(false);
  const [voiceSupported, setVoiceSupported] = useState(false);
  const [autoSpeak, setAutoSpeak] = useState(true);
  const [listeningTranscript, setListeningTranscript] = useState('');

  const scrollRef = useRef<ScrollView>(null);
  const pulseAnim = useRef(new Animated.Value(1)).current;

  // Pulse animation for voice recording
  useEffect(() => {
    let anim: Animated.CompositeAnimation | null = null;
    if (isListening) {
      anim = Animated.loop(
        Animated.sequence([
          Animated.timing(pulseAnim, { toValue: 1.25, duration: 600, useNativeDriver: true }),
          Animated.timing(pulseAnim, { toValue: 1.0, duration: 600, useNativeDriver: true }),
        ])
      );
      anim.start();
    } else {
      pulseAnim.setValue(1);
    }
    return () => {
      if (anim) anim.stop();
    };
  }, [isListening]);

  useEffect(() => {
    setVoiceSupported(SpeechService.isSupported());
  }, []);

  const scrollToBottom = () => {
    setTimeout(() => {
      scrollRef.current?.scrollToEnd({ animated: true });
    }, 150);
  };

  const handleSendMessage = (textToSend?: string) => {
    const query = (textToSend !== undefined ? textToSend : inputVal).trim();
    if (!query) return;

    const userMsg: MessageItem = {
      id: `u-${Date.now()}`,
      sender: 'user',
      text: query,
      timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
    };

    setInputVal('');
    setMessages(prev => [...prev, userMsg]);
    scrollToBottom();

    // Process intent
    const result = processPOSConversation(query, products, contextData);

    const assistantMsg: MessageItem = {
      id: `a-${Date.now()}`,
      sender: 'assistant',
      text: result.replyText,
      timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
      intentResult: result,
    };

    setMessages(prev => [...prev, assistantMsg]);
    scrollToBottom();

    // Automatic actions execution
    if (result.intent === 'ADD_TO_CART' && result.items && onAddToCart) {
      result.items.forEach(item => {
        if (item.matchedProduct) {
          onAddToCart(item.matchedProduct, item.qty);
        }
      });
    } else if (result.intent === 'CLEAR_CART' && onClearCart) {
      onClearCart();
    } else if (result.intent === 'APPLY_DISCOUNT' && result.discount && onApplyDiscount) {
      onApplyDiscount(result.discount);
    } else if (result.intent === 'CHECKOUT' && result.paymentMethod && onCheckout) {
      onCheckout(result.paymentMethod);
    }

    if (autoSpeak) {
      SpeechService.speak(result.replyText);
    }
  };

  const toggleVoiceRecording = () => {
    if (isListening) {
      SpeechService.stopListening();
      setIsListening(false);
      if (listeningTranscript.trim()) {
        handleSendMessage(listeningTranscript);
        setListeningTranscript('');
      }
    } else {
      setListeningTranscript('');
      const started = SpeechService.startListening(
        (transcript, isFinal) => {
          setListeningTranscript(transcript);
          if (isFinal) {
            setIsListening(false);
            handleSendMessage(transcript);
            setListeningTranscript('');
          }
        },
        err => {
          console.warn('Speech err:', err);
          setIsListening(false);
        },
        () => {
          setIsListening(false);
        }
      );
      if (started) {
        setIsListening(true);
      }
    }
  };

  const samplePrompts = [
    '🎙️ Add 2 Milk & 1 Bread',
    '📊 Today sales summary',
    '⚠️ Check low stock',
    '🧾 Clear billing cart',
    '💳 Pay by UPI',
    '🔍 Price of Sugar',
  ];

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <View style={styles.backdrop}>
        <Surface style={[styles.modalCard, { backgroundColor: isDarkMode ? '#1E293B' : '#FFFFFF' }]} elevation={5}>
          {/* Header */}
          <View style={[styles.header, { borderBottomColor: isDarkMode ? '#334155' : '#E2E8F0' }]}>
            <View style={styles.headerLeft}>
              <View style={[styles.botAvatar, { backgroundColor: isDarkMode ? '#047857' : '#E6FFFA' }]}>
                <Icon name="robot-happy" size={22} color={isDarkMode ? '#5EEAD4' : '#10B981'} />
              </View>
              <View>
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                  <Text style={[styles.headerTitle, { color: isDarkMode ? '#F8FAFC' : '#0F172A' }]}>
                    POS AI Copilot
                  </Text>
                  <View style={styles.liveBadge}>
                    <View style={styles.liveDot} />
                    <Text style={styles.liveText}>READY</Text>
                  </View>
                </View>
                <Text style={[styles.headerSub, { color: isDarkMode ? '#94A3B8' : '#64748B' }]}>
                  Voice & Conversational Store Assistant
                </Text>
              </View>
            </View>
            <View style={styles.headerRight}>
              <IconButton
                icon={autoSpeak ? 'volume-high' : 'volume-off'}
                iconColor={autoSpeak ? '#10B981' : '#94A3B8'}
                size={20}
                onPress={() => setAutoSpeak(!autoSpeak)}
              />
              <IconButton icon="close" iconColor={isDarkMode ? '#CBD5E1' : '#475569'} size={22} onPress={onClose} />
            </View>
          </View>

          {/* Quick Prompts Bar */}
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={styles.quickChipsContainer}
          >
            {samplePrompts.map((prompt, idx) => (
              <TouchableOpacity
                key={idx}
                style={[
                  styles.quickChip,
                  {
                    backgroundColor: isDarkMode ? '#0F172A' : '#F1F5F9',
                    borderColor: isDarkMode ? '#334155' : '#CBD5E1',
                  },
                ]}
                onPress={() => handleSendMessage(prompt.replace(/^[^\s]+\s+/, ''))}
              >
                <Text style={[styles.quickChipText, { color: isDarkMode ? '#E2E8F0' : '#334155' }]}>
                  {prompt}
                </Text>
              </TouchableOpacity>
            ))}
          </ScrollView>

          {/* Chat Messages */}
          <ScrollView ref={scrollRef} style={styles.messagesList} contentContainerStyle={styles.messagesContainer}>
            {messages.map(msg => {
              const isUser = msg.sender === 'user';
              return (
                <View
                  key={msg.id}
                  style={[
                    styles.messageRow,
                    isUser ? styles.messageRowUser : styles.messageRowAssistant,
                  ]}
                >
                  {!isUser && (
                    <View style={[styles.msgAvatar, { backgroundColor: isDarkMode ? '#047857' : '#A7F3D0' }]}>
                      <Icon name="robot" size={14} color={isDarkMode ? '#5EEAD4' : '#047857'} />
                    </View>
                  )}
                  <View
                    style={[
                      styles.bubble,
                      isUser
                        ? { backgroundColor: '#10B981' }
                        : { backgroundColor: isDarkMode ? '#0F172A' : '#F8FAFC', borderColor: isDarkMode ? '#334155' : '#E2E8F0', borderWidth: 1 },
                    ]}
                  >
                    <Text
                      style={[
                        styles.bubbleText,
                        { color: isUser ? '#FFFFFF' : isDarkMode ? '#F1F5F9' : '#1E293B' },
                      ]}
                    >
                      {msg.text}
                    </Text>

                    {/* Interactive Action Card if any */}
                    {msg.intentResult && msg.intentResult.targetRoute && (
                      <TouchableOpacity
                        style={styles.actionCard}
                        onPress={() => {
                          onClose();
                          if (msg.intentResult?.targetRoute) {
                            router.push(msg.intentResult.targetRoute as any);
                          }
                        }}
                      >
                        <Icon name="arrow-right-circle" size={18} color="#10B981" />
                        <Text style={styles.actionCardText}>Tap to open screen</Text>
                      </TouchableOpacity>
                    )}

                    {msg.intentResult && msg.intentResult.items && msg.intentResult.items.length > 0 && (
                      <View style={styles.itemsSummaryBox}>
                        {msg.intentResult.items.map((item, i) => (
                          <View key={i} style={styles.itemTag}>
                            <Icon
                              name={item.matchedProduct ? 'check-circle' : 'help-circle-outline'}
                              size={14}
                              color={item.matchedProduct ? '#10B981' : '#F59E0B'}
                            />
                            <Text style={styles.itemTagText}>
                              {item.qty}x {item.matchedProduct ? item.matchedProduct.name : item.name}
                            </Text>
                          </View>
                        ))}
                      </View>
                    )}

                    <Text
                      style={[
                        styles.timestamp,
                        { color: isUser ? 'rgba(255,255,255,0.7)' : isDarkMode ? '#64748B' : '#94A3B8' },
                      ]}
                    >
                      {msg.timestamp}
                    </Text>
                  </View>
                </View>
              );
            })}

            {isListening && (
              <View style={styles.listeningBox}>
                <Animated.View
                  style={[
                    styles.listeningWave,
                    { transform: [{ scale: pulseAnim }], backgroundColor: '#10B981' },
                  ]}
                >
                  <Icon name="microphone" size={24} color="#FFFFFF" />
                </Animated.View>
                <Text style={[styles.listeningText, { color: isDarkMode ? '#5EEAD4' : '#10B981' }]}>
                  {listeningTranscript || 'Listening... Speak now'}
                </Text>
              </View>
            )}
          </ScrollView>

          {/* Bottom Input Controls */}
          <View style={[styles.inputBar, { borderTopColor: isDarkMode ? '#334155' : '#E2E8F0' }]}>
            <TextInput
              style={[
                styles.textInput,
                {
                  backgroundColor: isDarkMode ? '#0F172A' : '#F1F5F9',
                  color: isDarkMode ? '#FFFFFF' : '#000000',
                  borderColor: isDarkMode ? '#334155' : '#CBD5E1',
                },
              ]}
              placeholder="Type or speak (e.g. 'Add 2 Milk')..."
              placeholderTextColor={isDarkMode ? '#64748B' : '#94A3B8'}
              value={inputVal}
              onChangeText={setInputVal}
              onSubmitEditing={() => handleSendMessage()}
              returnKeyType="send"
            />

            {voiceSupported && (
              <TouchableOpacity
                style={[
                  styles.voiceButton,
                  isListening ? styles.voiceButtonActive : { backgroundColor: isDarkMode ? '#334155' : '#E2E8F0' },
                ]}
                onPress={toggleVoiceRecording}
              >
                <Icon
                  name={isListening ? 'stop' : 'microphone'}
                  size={20}
                  color={isListening ? '#FFFFFF' : isDarkMode ? '#5EEAD4' : '#10B981'}
                />
              </TouchableOpacity>
            )}

            <TouchableOpacity
              style={[
                styles.sendButton,
                { backgroundColor: inputVal.trim() ? '#10B981' : isDarkMode ? '#334155' : '#CBD5E1' },
              ]}
              disabled={!inputVal.trim()}
              onPress={() => handleSendMessage()}
            >
              <Icon name="send" size={18} color="#FFFFFF" />
            </TouchableOpacity>
          </View>
        </Surface>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'flex-end',
  },
  modalCard: {
    height: Platform.OS === 'web' ? '82%' : '88%',
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    overflow: 'hidden',
    display: 'flex',
    flexDirection: 'column',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 1,
  },
  headerLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  botAvatar: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerTitle: {
    fontSize: 16,
    fontWeight: '700',
  },
  headerSub: {
    fontSize: 11,
    marginTop: 2,
  },
  headerRight: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  liveBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(16, 185, 129, 0.15)',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 8,
    gap: 4,
  },
  liveDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: '#10B981',
  },
  liveText: {
    fontSize: 9,
    fontWeight: '700',
    color: '#10B981',
  },
  quickChipsContainer: {
    paddingHorizontal: 16,
    paddingVertical: 10,
    gap: 8,
    flexDirection: 'row',
  },
  quickChip: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 16,
    borderWidth: 1,
  },
  quickChipText: {
    fontSize: 12,
    fontWeight: '500',
  },
  messagesList: {
    flex: 1,
  },
  messagesContainer: {
    padding: 16,
    gap: 14,
  },
  messageRow: {
    flexDirection: 'row',
    gap: 8,
    maxWidth: '85%',
  },
  messageRowUser: {
    alignSelf: 'flex-end',
    justifyContent: 'flex-end',
  },
  messageRowAssistant: {
    alignSelf: 'flex-start',
    justifyContent: 'flex-start',
  },
  msgAvatar: {
    width: 26,
    height: 26,
    borderRadius: 13,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 4,
  },
  bubble: {
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderRadius: 16,
  },
  bubbleText: {
    fontSize: 14,
    lineHeight: 20,
  },
  timestamp: {
    fontSize: 10,
    marginTop: 4,
    alignSelf: 'flex-end',
  },
  actionCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: 'rgba(13, 148, 136, 0.1)',
    padding: 8,
    borderRadius: 8,
    marginTop: 8,
  },
  actionCardText: {
    fontSize: 12,
    fontWeight: '600',
    color: '#10B981',
  },
  itemsSummaryBox: {
    marginTop: 8,
    gap: 4,
  },
  itemTag: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: 'rgba(0,0,0,0.05)',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 6,
  },
  itemTagText: {
    fontSize: 12,
    fontWeight: '500',
  },
  listeningBox: {
    alignItems: 'center',
    justifyContent: 'center',
    padding: 16,
    gap: 10,
  },
  listeningWave: {
    width: 56,
    height: 56,
    borderRadius: 28,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#10B981',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.4,
    shadowRadius: 8,
    elevation: 6,
  },
  listeningText: {
    fontSize: 13,
    fontWeight: '600',
  },
  inputBar: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 12,
    gap: 8,
    borderTopWidth: 1,
  },
  textInput: {
    flex: 1,
    height: 42,
    borderRadius: 21,
    paddingHorizontal: 16,
    fontSize: 14,
    borderWidth: 1,
  },
  voiceButton: {
    width: 42,
    height: 42,
    borderRadius: 21,
    alignItems: 'center',
    justifyContent: 'center',
  },
  voiceButtonActive: {
    backgroundColor: '#EF4444',
  },
  sendButton: {
    width: 42,
    height: 42,
    borderRadius: 21,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
