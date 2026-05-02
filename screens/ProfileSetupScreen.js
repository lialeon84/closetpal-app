import React, { useState } from 'react';
import {
  View,
  Text,
  TextInput,
  Pressable,
  StyleSheet,
  Alert,
  ActivityIndicator,
  ScrollView,
  Platform,
} from 'react-native';
import DateTimePicker from '@react-native-community/datetimepicker';
import { Picker } from '@react-native-picker/picker';
import { supabase } from '../lib/supabase';
import {
  US_STATES,
  GENDERS,
  formatDateForDisplay,
  formatDateForDB,
} from '../lib/constants';

export default function ProfileSetupScreen() {
  const [username, setUsername] = useState('');
  const [firstName, setFirstName] = useState('');
  const [lastName, setLastName] = useState('');
  const [city, setCity] = useState('');
  const [state, setState] = useState('');
  const [gender, setGender] = useState('');
  const [dob, setDob] = useState(null);
  const [showDatePicker, setShowDatePicker] = useState(false);
  const [loading, setLoading] = useState(false);

  const handleSubmit = async () => {
    if (!username || !firstName || !lastName || !city || !state || !gender || !dob) {
      Alert.alert('Error', 'Please fill in all required fields');
      return;
    }

    setLoading(true);

    const { data: { user } } = await supabase.auth.getUser();

    if (!user) {
      Alert.alert('Error', 'Not authenticated');
      setLoading(false);
      return;
    }

    const { error } = await supabase
      .from('profiles')
      .insert({
        id: user.id,
        username: username.toLowerCase().trim(),
        first_name: firstName.trim(),
        last_name: lastName.trim(),
        city: city.trim(),
        state,
        gender,
        date_of_birth: formatDateForDB(dob),
        subscription_tier: 'free',
      })
      .select()
      .single();

    setLoading(false);

    if (error) {
      if (error.code === '23505') {
        Alert.alert('Error', 'Username already taken. Please choose another.');
      } else {
        Alert.alert('Error', error.message);
      }
    } else {
      Alert.alert('Welcome!', `Your ClosetPal is ready, ${firstName}! 🐾`);
      await supabase.auth.refreshSession();
    }
  };

  return (
    <View style={styles.container}>
      <ScrollView contentContainerStyle={styles.scrollContent}>
        <View style={styles.header}>
          <Text style={styles.title}>Set Up Your Profile</Text>
          <Text style={styles.subtitle}>Let's personalize your experience</Text>
        </View>

        <View style={styles.form}>
          <Text style={styles.label}>Username *</Text>
          <TextInput
            style={styles.input}
            placeholder="e.g. stylerose"
            placeholderTextColor="#9B9B9B"
            value={username}
            onChangeText={setUsername}
            autoCapitalize="none"
          />

          <Text style={styles.label}>First Name *</Text>
          <TextInput
            style={styles.input}
            placeholder="First Name"
            placeholderTextColor="#9B9B9B"
            value={firstName}
            onChangeText={setFirstName}
          />

          <Text style={styles.label}>Last Name *</Text>
          <TextInput
            style={styles.input}
            placeholder="Last Name"
            placeholderTextColor="#9B9B9B"
            value={lastName}
            onChangeText={setLastName}
          />

          <Text style={styles.label}>City *</Text>
          <TextInput
            style={styles.input}
            placeholder="e.g. Los Angeles"
            placeholderTextColor="#9B9B9B"
            value={city}
            onChangeText={setCity}
          />

          <Text style={styles.label}>State *</Text>
          <View style={styles.pickerContainer}>
            <Picker
              selectedValue={state}
              onValueChange={setState}
              style={styles.picker}
              dropdownIconColor="#9b59b6"
            >
              {US_STATES.map((s) => (
                <Picker.Item key={s.value} label={s.label} value={s.value} color="#1C1C1C" />
              ))}
            </Picker>
          </View>

          <Text style={styles.label}>Gender *</Text>
          <View style={styles.pickerContainer}>
            <Picker
              selectedValue={gender}
              onValueChange={setGender}
              style={styles.picker}
              dropdownIconColor="#9b59b6"
            >
              {GENDERS.map((g) => (
                <Picker.Item key={g.value} label={g.label} value={g.value} color="#1C1C1C" />
              ))}
            </Picker>
          </View>

          <Text style={styles.label}>Date of Birth *</Text>
          <Pressable style={styles.dateButton} onPress={() => setShowDatePicker(true)}>
            <Text style={styles.dateButtonText}>
              {dob ? formatDateForDisplay(dob) : 'MM/DD/YYYY'}
            </Text>
          </Pressable>
          {showDatePicker && (
            <DateTimePicker
              value={dob || new Date(2000, 0, 1)}
              mode="date"
              display="default"
              maximumDate={new Date()}
              onChange={(event, selectedDate) => {
                setShowDatePicker(Platform.OS === 'ios');
                if (selectedDate) setDob(selectedDate);
              }}
            />
          )}

          <Pressable
            style={[styles.button, loading && styles.buttonDisabled]}
            onPress={handleSubmit}
            disabled={loading}
          >
            {loading ? (
              <ActivityIndicator color="#fff" />
            ) : (
              <Text style={styles.buttonText}>Get Started</Text>
            )}
          </Pressable>

          <Text style={styles.note}>* All fields are required</Text>
        </View>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F7F5F0',
  },
  scrollContent: {
    flexGrow: 1,
    padding: 20,
  },
  header: {
    marginTop: 60,
    marginBottom: 40,
    alignItems: 'center',
  },
  title: {
    fontSize: 28,
    fontWeight: 'bold',
    color: '#1C1C1C',
    marginBottom: 10,
  },
  subtitle: {
    fontSize: 16,
    color: '#9b59b6',
  },
  form: {
    width: '100%',
  },
  label: {
    color: '#9b59b6',
    fontSize: 14,
    fontWeight: '600',
    marginBottom: 8,
    marginTop: 15,
  },
  input: {
    backgroundColor: '#EDEAE4',
    color: '#1C1C1C',
    padding: 15,
    borderRadius: 10,
    fontSize: 16,
    borderWidth: 1,
    borderColor: '#D9D5CE',
  },
  pickerContainer: {
    backgroundColor: '#EDEAE4',
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#D9D5CE',
    overflow: 'hidden',
  },
  picker: {
    color: '#1C1C1C',
    backgroundColor: '#EDEAE4',
  },
  dateButton: {
    backgroundColor: '#EDEAE4',
    padding: 15,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#D9D5CE',
  },
  dateButtonText: {
    color: '#1C1C1C',
    fontSize: 16,
  },
  button: {
    backgroundColor: '#9b59b6',
    padding: 15,
    borderRadius: 10,
    alignItems: 'center',
    marginTop: 30,
  },
  buttonDisabled: {
    opacity: 0.5,
  },
  buttonText: {
    color: '#fff',
    fontSize: 18,
    fontWeight: 'bold',
  },
  note: {
    color: '#6B7280',
    fontSize: 12,
    textAlign: 'center',
    marginTop: 20,
    marginBottom: 40,
    fontStyle: 'italic',
  },
});
