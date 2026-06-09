import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  Alert,
} from 'react-native';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { RootStackParamList } from '../types';
import { useTheme } from '../contexts/ThemeContext';
import { getServerUrl, saveServerUrl } from '../services/api';
import { SettingsIcon } from '../components/Icons';

type Props = NativeStackScreenProps<RootStackParamList, 'ServerSettings'>;

export default function ServerSettingsScreen({ navigation }: Props) {
  const { colors } = useTheme();
  const [serverUrl, setServerUrl] = useState('');
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    getServerUrl().then((url) => setServerUrl(url));
  }, []);

  async function handleSave() {
    if (!serverUrl.trim()) {
      Alert.alert('Error', 'Please enter a server URL');
      return;
    }
    setLoading(true);
    try {
      const clean = serverUrl.trim().replace(/\/$/, '');
      await saveServerUrl(clean);
      navigation.navigate('Login');
    } catch (err) {
      Alert.alert('Error', 'Failed to save server URL');
    } finally {
      setLoading(false);
    }
  }

  return (
    <KeyboardAvoidingView
      style={[styles.container, { backgroundColor: colors.background }]}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >
      <ScrollView contentContainerStyle={styles.scrollContent} keyboardShouldPersistTaps="handled">
        <View style={styles.iconContainer}>
          <View style={[styles.iconCircle, { backgroundColor: colors.primary }]}>
            <SettingsIcon size={32} color="#ffffff" />
          </View>
        </View>

        <Text style={[styles.title, { color: colors.text }]}>Server Configuration</Text>
        <Text style={[styles.subtitle, { color: colors.textMuted }]}>
          Enter the URL of your Skyface verification server
        </Text>

        <View style={[styles.card, { backgroundColor: colors.surface, borderColor: colors.border }]}>
          <Text style={[styles.label, { color: colors.textMuted }]}>SERVER URL</Text>
          <TextInput
            style={[styles.input, { backgroundColor: colors.surfaceVariant, color: colors.text, borderColor: colors.border }]}
            value={serverUrl}
            onChangeText={setServerUrl}
            placeholder="http://192.168.1.100:3002"
            placeholderTextColor={colors.textMuted}
            autoCapitalize="none"
            autoCorrect={false}
            keyboardType="url"
          />
          <Text style={[styles.hint, { color: colors.textMuted }]}>
            Include the protocol (http:// or https://) and port number
          </Text>
        </View>

        <TouchableOpacity
          style={[styles.button, { backgroundColor: loading ? colors.surfaceVariant : colors.primary }]}
          onPress={handleSave}
          disabled={loading}
          activeOpacity={0.8}
        >
          <Text style={styles.buttonText}>{loading ? 'Saving…' : 'Save & Continue'}</Text>
        </TouchableOpacity>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  scrollContent: {
    flexGrow: 1,
    paddingHorizontal: 24,
    paddingTop: 60,
    paddingBottom: 40,
    alignItems: 'center',
  },
  iconContainer: {
    marginBottom: 24,
  },
  iconCircle: {
    width: 80,
    height: 80,
    borderRadius: 40,
    alignItems: 'center',
    justifyContent: 'center',
  },
  title: {
    fontSize: 26,
    fontWeight: 'bold',
    marginBottom: 8,
    textAlign: 'center',
  },
  subtitle: {
    fontSize: 14,
    textAlign: 'center',
    lineHeight: 20,
    marginBottom: 32,
    paddingHorizontal: 20,
  },
  card: {
    width: '100%',
    borderRadius: 16,
    borderWidth: 1,
    padding: 20,
    marginBottom: 24,
  },
  label: {
    fontSize: 11,
    fontWeight: '600',
    letterSpacing: 0.8,
    marginBottom: 8,
  },
  input: {
    borderRadius: 10,
    borderWidth: 1,
    paddingHorizontal: 14,
    paddingVertical: 12,
    fontSize: 15,
    marginBottom: 8,
  },
  hint: {
    fontSize: 12,
    lineHeight: 16,
  },
  button: {
    width: '100%',
    paddingVertical: 16,
    borderRadius: 14,
    alignItems: 'center',
  },
  buttonText: {
    color: '#ffffff',
    fontWeight: '700',
    fontSize: 16,
  },
});
