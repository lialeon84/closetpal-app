// Authentication screen for returning users. Validates email and password, normalizes
// the email before submission, and delegates sign-in to Supabase Auth. Navigation
// after a successful login is handled by the auth state listener in the root navigator.
import React, { useState } from 'react';
import {
  View,
  Text,
  TextInput,
  Pressable,
  StyleSheet,
  Alert,
  KeyboardAvoidingView,
  ScrollView,
  Platform,
  TouchableWithoutFeedback,
  Keyboard,
} from 'react-native';
import { supabase } from '../lib/supabase';
import { PRIMARY } from '../constants/colors';
import { FONTS } from '../constants/fonts';

// Main screen component. Provides email/password fields and a link to the signup flow.
export default function LoginScreen({ navigation }) {
  // Form field values and async operation flag.
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);

  // Validates both fields are non-empty, then calls Supabase signInWithPassword.
  // On success, the root navigator's auth listener detects the session change and redirects.
  const handleLogin = async () => {
    if (!email || !password) {
      Alert.alert('Error', 'Please fill in all fields');
      return;
    }

    setLoading(true);

    const { error } = await supabase.auth.signInWithPassword({
      email: email.toLowerCase().trim(), // normalize before sending — Supabase auth is case-sensitive
      password: password,
    });

    setLoading(false);

    if (error) {
      Alert.alert('Error', error.message);
    }
  };

  return (
    <KeyboardAvoidingView
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      style={{ flex: 1 }}
    >
      <ScrollView
        contentContainerStyle={styles.scrollContainer}
        keyboardShouldPersistTaps="handled"
      >
          <View style={styles.content}>
            <Text style={styles.title}>Welcome Back </Text>
            <Text style={styles.subtitle}>Sign in to your account</Text>

            <View style={styles.form}>
              <TextInput
                style={styles.input}
                placeholder="Email"
                placeholderTextColor="#9B9B9B"
                value={email}
                onChangeText={setEmail}
                autoCapitalize="none"
                keyboardType="email-address"
                returnKeyType="next"
              />

              <TextInput
                style={styles.input}
                placeholder="Password"
                placeholderTextColor="#9B9B9B"
                value={password}
                onChangeText={setPassword}
                secureTextEntry
                returnKeyType="done"
                blurOnSubmit={true}
                onSubmitEditing={() => Keyboard.dismiss()} // dismiss keyboard when the user taps the Done key
              />

              <Pressable
                style={[styles.button, loading && styles.buttonDisabled]}
                onPress={handleLogin}
                disabled={loading}
              >
                <Text style={styles.buttonText}>
                  {loading ? 'Signing in...' : 'Sign In'}
                </Text>
              </Pressable>

              <Pressable onPress={() => navigation.navigate('Signup')}>
                <Text style={styles.linkText}>
                  Don't have an account?{' '}
                  <Text style={styles.linkBold}>Sign up</Text>
                </Text>
              </Pressable>
            </View>
          </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

// Styles for LoginScreen — scroll container, title, form fields, sign-in button, and signup link.
const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F7F5F0',
  },
  scrollContainer: {
    flexGrow: 1,
    backgroundColor: '#F7F5F0',
  },
  content: {
    flex: 1,
    justifyContent: 'center',
    padding: 20,
  },
  title: {
    fontSize: 32,
    fontWeight: 'bold',
    color: '#1C1C1C',
    textAlign: 'center',
    marginBottom: 10,
    fontFamily: FONTS.heading,
  },
  subtitle: {
    fontSize: 16,
    color: PRIMARY,
    textAlign: 'center',
    marginBottom: 40,
    fontFamily: FONTS.headingRegular,
  },
  form: {
    width: '100%',
  },
  input: {
    backgroundColor: '#EDEAE4',
    color: '#1C1C1C',
    padding: 15,
    borderRadius: 10,
    fontSize: 16,
    marginBottom: 15,
    borderWidth: 1,
    borderColor: '#D9D5CE',
    fontFamily: FONTS.bodyMedium,
  },
  button: {
    backgroundColor: PRIMARY,
    padding: 15,
    borderRadius: 10,
    alignItems: 'center',
    marginTop: 10,
  },
  buttonDisabled: {
    opacity: 0.5,
  },
  buttonText: {
    color: '#fff',
    fontSize: 18,
    fontWeight: 'bold',
    fontFamily: FONTS.bodyBold,
  },
  linkText: {
    color: '#6B7280',
    textAlign: 'center',
    marginTop: 20,
    fontSize: 14,
    fontFamily: FONTS.body,
  },
  linkBold: {
    color: PRIMARY,
    fontWeight: 'bold',
    fontFamily: FONTS.bodyBold,
  },
});
