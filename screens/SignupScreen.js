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
  Keyboard,
} from 'react-native';
import { supabase } from '../lib/supabase';
import { PRIMARY } from '../constants/colors';
import { FONTS } from '../constants/fonts';

export default function SignupScreen({ navigation }) {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [passwordError, setPasswordError] = useState('');

  const validatePassword = (pass) => {
    if (pass.length < 8) return 'At least 8 characters required';
    if (!/[A-Z]/.test(pass)) return 'Must include at least one uppercase letter';
    if (!/[0-9]/.test(pass)) return 'Must include at least one number';
    if (!/[!@#$%^&*()_+\-=[\]{};':"\\|,.<>/?]/.test(pass)) return 'Must include at least one special character';
    return '';
  };

  const handleSignup = async () => {
    if (!email || !password || !confirmPassword) {
      Alert.alert('Error', 'Please fill in all fields');
      return;
    }

    if (password !== confirmPassword) {
      Alert.alert('Error', 'Passwords do not match');
      return;
    }

    const pwErr = validatePassword(password);
    if (pwErr) {
      setPasswordError(pwErr);
      return;
    }

    setLoading(true);

    const { error } = await supabase.auth.signUp({
      email: email.toLowerCase().trim(),
      password: password,
    });

    setLoading(false);

    if (error) {
      Alert.alert('Error', error.message);
    } else {
      Alert.alert(
        'Check Your Email',
        `We sent a verification link to ${email.toLowerCase().trim()}. Please verify your email before signing in.`,
        [{ text: 'Go to Sign In', onPress: () => navigation.navigate('Login') }]
      );
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
            <Text style={styles.title}>Join Ari's Closet </Text>
            <Text style={styles.subtitle}>Create your account and meet your companion</Text>

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
                onChangeText={(text) => {
                  setPassword(text);
                  setPasswordError(text.length > 0 ? validatePassword(text) : '');
                }}
                secureTextEntry
                returnKeyType="next"
                blurOnSubmit={true}
                onSubmitEditing={() => Keyboard.dismiss()}
              />
              {passwordError ? <Text style={styles.errorText}>{passwordError}</Text> : null}

              <TextInput
                style={styles.input}
                placeholder="Confirm Password"
                placeholderTextColor="#9B9B9B"
                value={confirmPassword}
                onChangeText={setConfirmPassword}
                secureTextEntry
                returnKeyType="done"
                blurOnSubmit={true}
                onSubmitEditing={() => Keyboard.dismiss()}
              />

              <Pressable
                style={[styles.button, (loading || passwordError !== '') && styles.buttonDisabled]}
                onPress={handleSignup}
                disabled={loading || passwordError !== ''}
              >
                <Text style={styles.buttonText}>
                  {loading ? 'Creating account...' : 'Sign Up'}
                </Text>
              </Pressable>

              <Pressable onPress={() => navigation.navigate('Login')}>
                <Text style={styles.linkText}>
                  Already have an account?{' '}
                  <Text style={styles.linkBold}>Sign in</Text>
                </Text>
              </Pressable>
            </View>
          </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

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
  errorText: {
    color: '#e74c3c',
    fontSize: 12,
    marginTop: -10,
    marginBottom: 10,
    fontFamily: FONTS.body,
  },
});
