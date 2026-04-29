import axios from 'axios';

// Replace with your computer's local IP address
// Find it by running: ipconfig getifaddr en0 (Mac) in terminal
const API_URL = 'https://francoise-nonconversant-drivellingly.ngrok-free.dev/api ';

export const api = axios.create({
  baseURL: API_URL,
  headers: {
    'Content-Type': 'application/json',
  },
});

// Add token to requests if it exists
export const setAuthToken = (token) => {
  if (token) {
    api.defaults.headers.common['Authorization'] = `Bearer ${token}`;
  } else {
    delete api.defaults.headers.common['Authorization'];
  }
};