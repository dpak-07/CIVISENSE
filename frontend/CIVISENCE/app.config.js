require('dotenv').config();

const appJson = require('./app.json');

const googleMapsApiKey =
  process.env.EXPO_PUBLIC_GOOGLE_MAPS_API_KEY ||
  process.env.GOOGLE_MAPS_API_KEY ||
  'AIzaSyDdJ-llNLS4ASa3O4JbyC8hQqOignm3kRg';

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
