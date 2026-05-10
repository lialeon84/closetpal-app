import React from 'react';
import { View, Text, StyleSheet, Pressable } from 'react-native';
import { PRIMARY } from '../constants/colors';
import { FONTS } from '../constants/fonts';

export default function WelcomeScreen({ navigation }) {
  return (
    <View style={styles.container}>
      <Text style={styles.title}>Ari's Closet 🌸</Text>
      <Text style={styles.subtitle}>Your AI Wardrobe Stylist</Text>

      <Pressable
        style={styles.button}
        onPress={() => navigation.navigate('Login')}
      >
        <Text style={styles.buttonText}>Login</Text>
      </Pressable>

      <Pressable
        style={[styles.button, styles.secondaryButton]}
        onPress={() => navigation.navigate('Signup')}
      >
        <Text style={[styles.buttonText, styles.secondaryButtonText]}>Sign Up</Text>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F7F5F0',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 20,
  },
  title: {
    fontSize: 40,
    color: '#1C1C1C',
    marginBottom: 10,
    fontFamily: FONTS.heading,
  },
  subtitle: {
    fontSize: 18,
    color: PRIMARY,
    marginBottom: 50,
    textAlign: 'center',
    fontFamily: FONTS.headingRegular,
  },
  button: {
    backgroundColor: PRIMARY,
    padding: 16,
    borderRadius: 12,
    width: '100%',
    marginBottom: 16,
  },
  buttonText: {
    color: '#fff',
    textAlign: 'center',
    fontSize: 18,
    fontWeight: '600',
    fontFamily: FONTS.bodyMedium,
  },
  secondaryButton: {
    backgroundColor: 'transparent',
    borderWidth: 2,
    borderColor: PRIMARY,
  },
  secondaryButtonText: {
    color: PRIMARY,
  },
});
