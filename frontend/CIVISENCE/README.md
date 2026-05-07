# Welcome to your Expo app 👋

This is an [Expo](https://expo.dev) project created with [`create-expo-app`](https://www.npmjs.com/package/create-expo-app).

## Get started

1. Install dependencies

   ```bash
   npm install
   ```

2. Start the app

   ```bash
   npx expo start
   ```

## Backend API setup

Set your backend base URL before launching the app:

```bash
EXPO_PUBLIC_API_BASE_URL=https://civisence.duckdns.org/api
```

Notes:
- If `EXPO_PUBLIC_API_BASE_URL` is not set, production builds default to `https://civisence.duckdns.org/api`.
- Android emulator usually needs `http://10.0.2.2:5000/api`.
- Physical devices should use your machine LAN IP, for example `http://192.168.1.20:5000/api`.

## Session + push notifications

- Auth session is now persisted locally with AsyncStorage.
- App restores session at startup before rendering routes.
- App polls backend `GET /notifications` every 30 seconds when logged in.
- New unread backend notifications are shown as local push notifications.
- Logout clears the persisted session.

In the output, you'll find options to open the app in a

- [development build](https://docs.expo.dev/develop/development-builds/introduction/)
- [Android emulator](https://docs.expo.dev/workflow/android-studio-emulator/)
- [iOS simulator](https://docs.expo.dev/workflow/ios-simulator/)
- [Expo Go](https://expo.dev/go), a limited sandbox for trying out app development with Expo

You can start developing by editing the files inside the **app** directory. This project uses [file-based routing](https://docs.expo.dev/router/introduction).

## Get a fresh project

When you're ready, run:

```bash
npm run reset-project
```

This command will move the starter code to the **app-example** directory and create a blank **app** directory where you can start developing.

## Learn more

To learn more about developing your project with Expo, look at the following resources:

- [Expo documentation](https://docs.expo.dev/): Learn fundamentals, or go into advanced topics with our [guides](https://docs.expo.dev/guides).
- [Learn Expo tutorial](https://docs.expo.dev/tutorial/introduction/): Follow a step-by-step tutorial where you'll create a project that runs on Android, iOS, and the web.

## Join the community

Join our community of developers creating universal apps.

- [Expo on GitHub](https://github.com/expo/expo): View our open source platform and contribute.
- [Discord community](https://chat.expo.dev): Chat with Expo users and ask questions.
