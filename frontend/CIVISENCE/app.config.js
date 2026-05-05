require('dotenv').config();

const appJson = require('./app.json');

const googleMapsApiKey =
  process.env.EXPO_PUBLIC_GOOGLE_MAPS_API_KEY ||
  process.env.GOOGLE_MAPS_API_KEY ||
  'AIzaSyBJd3logaKPylMJ4wLALnRlLXko5hoANKc';

module.exports = () => ({
  ...appJson.expo,
  android: {
    ...(appJson.expo.android || {}),
    config: {
      ...((appJson.expo.android && appJson.expo.android.config) || {}),
      googleMaps: {
        apiKey: googleMapsApiKey
      }
    }
  },
  extra: {
    ...(appJson.expo.extra || {}),
    googleMapsApiKey
  }
});
