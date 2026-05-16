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
  Modal,
  ActivityIndicator,
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

  const [showForgotModal, setShowForgotModal] = useState(false);
  const [resetEmail, setResetEmail]           = useState('');
  const [resetLoading, setResetLoading]       = useState(false);
  const [resetError, setResetError]           = useState('');
  const [resetSuccess, setResetSuccess]       = useState(false);

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

  const handleResetPassword = async () => {
    const trimmed = resetEmail.trim().toLowerCase();
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(trimmed)) {
      setResetError('Please enter a valid email address.');
      return;
    }
    setResetError('');
    setResetLoading(true);
    try {
      const { error } = await supabase.auth.resetPasswordForEmail(trimmed, {
        redirectTo: 'https://ariscloset.app/reset.html',
      });
      const isNotFound = error?.message?.toLowerCase().includes('not found');
      if (error && !isNotFound) {
        console.log('[ResetPassword error]', error); // TEMPORARY - remove before commit
        setResetError('Something went wrong. Please try again.');
      } else {
        setResetSuccess(true);
        setTimeout(() => { setShowForgotModal(false); setResetSuccess(false); }, 2000);
      }
    } catch (_) {
      setResetError('Something went wrong. Please try again.');
    } finally {
      setResetLoading(false);
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
                style={styles.forgotPasswordLink}
                onPress={() => {
                  setResetEmail(email);
                  setResetError('');
                  setResetSuccess(false);
                  setShowForgotModal(true);
                }}
              >
                <Text style={styles.forgotPasswordText}>Forgot Password?</Text>
              </Pressable>

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

      <Modal
        visible={showForgotModal}
        transparent
        animationType="fade"
        onRequestClose={() => !resetLoading && setShowForgotModal(false)}
      >
        <TouchableWithoutFeedback onPress={() => !resetLoading && setShowForgotModal(false)}>
          <View style={styles.modalOverlay}>
            <TouchableWithoutFeedback>
              <View style={styles.modalCard}>
                <Text style={styles.modalHeading}>Reset Password</Text>
                <Text style={styles.modalInstructions}>
                  Enter your email address and we'll send you a link to reset your password.
                </Text>

                {resetSuccess ? (
                  <Text style={styles.successText}>
                    If an account exists for that email, you'll receive a password reset link shortly. The link expires in 1 hour.
                  </Text>
                ) : (
                  <>
                    <TextInput
                      style={[styles.input, resetLoading && styles.inputDisabled]}
                      placeholder="Email"
                      placeholderTextColor="#9B9B9B"
                      value={resetEmail}
                      onChangeText={(t) => { setResetEmail(t); setResetError(''); }}
                      autoCapitalize="none"
                      keyboardType="email-address"
                      editable={!resetLoading}
                    />
                    {resetError ? <Text style={styles.errorText}>{resetError}</Text> : null}
                    <Pressable
                      style={[styles.button, styles.resetButton, resetLoading && styles.buttonDisabled]}
                      onPress={handleResetPassword}
                      disabled={resetLoading}
                    >
                      {resetLoading
                        ? <ActivityIndicator color="#fff" />
                        : <Text style={styles.buttonText}>Send Reset Link</Text>
                      }
                    </Pressable>
                    <Pressable
                      style={styles.cancelLink}
                      onPress={() => setShowForgotModal(false)}
                      disabled={resetLoading}
                    >
                      <Text style={styles.cancelLinkText}>Cancel</Text>
                    </Pressable>
                  </>
                )}
              </View>
            </TouchableWithoutFeedback>
          </View>
        </TouchableWithoutFeedback>
      </Modal>
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
  forgotPasswordLink: {
    alignSelf: 'flex-end',
    marginTop: -5,
    marginBottom: 12,
  },
  forgotPasswordText: {
    fontSize: 13,
    color: PRIMARY,
    fontFamily: FONTS.body,
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.35)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 24,
  },
  modalCard: {
    backgroundColor: '#F7F5F0',
    borderRadius: 20,
    padding: 24,
    width: '100%',
  },
  modalHeading: {
    fontSize: 22,
    fontWeight: 'bold',
    color: '#1C1C1C',
    marginBottom: 10,
    fontFamily: FONTS.heading,
  },
  modalInstructions: {
    fontSize: 14,
    color: '#6B7280',
    marginBottom: 18,
    lineHeight: 20,
    fontFamily: FONTS.body,
  },
  errorText: {
    color: '#E53935',
    fontSize: 13,
    marginTop: -8,
    marginBottom: 10,
    fontFamily: FONTS.body,
  },
  successText: {
    fontSize: 14,
    color: '#4CAF50',
    lineHeight: 22,
    fontFamily: FONTS.body,
    textAlign: 'center',
    paddingVertical: 12,
  },
  resetButton: {
    marginTop: 6,
  },
  cancelLink: {
    alignItems: 'center',
    marginTop: 14,
  },
  cancelLinkText: {
    fontSize: 14,
    color: '#6B7280',
    fontFamily: FONTS.body,
  },
  inputDisabled: {
    opacity: 0.5,
  },
});
