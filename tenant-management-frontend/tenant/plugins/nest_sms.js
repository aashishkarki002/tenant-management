import axios from 'axios';
const NESTSMS_API_KEY = import.meta.env.VITE_NESTSMS_API_KEY;
const NESTSMS_BASE_URL = import.meta.env.VITE_NESTSMS_BASE_URL;

const nestSms = axios.create({
  baseURL: NESTSMS_BASE_URL,
  headers: {
    'Authorization': `Bearer ${NESTSMS_API_KEY}`,
    'Content-Type': 'application/json'
  }
});

export default nestSms;