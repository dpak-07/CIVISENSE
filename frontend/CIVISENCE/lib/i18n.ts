import { AppLanguage } from "@/lib/preferences";

type TranslationKey =
  | "common.cancel"
  | "common.close"
  | "common.loading"
  | "app.tagline"
  | "home.welcomeBack"
  | "home.citizen"
  | "home.reportIssue"
  | "home.submitNewComplaint"
  | "home.trackStatus"
  | "home.reportsCount"
  | "home.cityMap"
  | "home.exploreIssues"
  | "home.myReports"
  | "home.unreadAlerts"
  | "home.empoweringCitizens"
  | "auth.welcomeBack"
  | "auth.createAccount"
  | "auth.emailAddress"
  | "auth.password"
  | "auth.signIn"
  | "auth.signUp"
  | "auth.fullName"
  | "auth.confirmPassword"
  | "auth.createAccountButton"
  | "auth.alreadyHaveAccount"
  | "auth.dontHaveAccount"
  | "auth.forgotPassword"
  | "auth.permissionNeeded"
  | "auth.allowPhotoAccess"
  | "auth.removePhoto"
  | "auth.addProfilePhoto"
  | "settings.title"
  | "settings.account"
  | "settings.preferences"
  | "settings.latestNotifications"
  | "settings.accountActions"
  | "settings.pushNotifications"
  | "settings.locationServices"
  | "settings.darkMode"
  | "settings.language"
  | "settings.signOut"
  | "settings.deleteAccount"
  | "settings.typeDelete"
  | "settings.delete"
  | "settings.systemGranted"
  | "settings.systemDenied"
  | "settings.systemUnknown"
  | "settings.unreadCount"
  | "settings.languageEnglish"
  | "settings.languageTamil"
  | "settings.languageHindi"
  | "settings.changeLanguage"
  | "settings.languageUpdated"
  | "settings.permissionDenied"
  | "settings.enableNotifications"
  | "settings.enableLocation";

type Dictionary = Record<TranslationKey, string>;
type TranslationParams = Record<string, string | number>;

const translations: Record<AppLanguage, Dictionary> = {
  en: {
    "common.cancel": "Cancel",
    "common.close": "Close",
    "common.loading": "Loading...",
    "app.tagline": "Making Cities Better",
    "home.welcomeBack": "Welcome back",
    "home.citizen": "Citizen",
    "home.reportIssue": "Report Issue",
    "home.submitNewComplaint": "Submit new complaint",
    "home.trackStatus": "Track Status",
    "home.reportsCount": "{count} report(s)",
    "home.cityMap": "City Map",
    "home.exploreIssues": "Explore issues",
    "home.myReports": "My Reports",
    "home.unreadAlerts": "{count} unread alerts",
    "home.empoweringCitizens": "Empowering citizens to build better communities",
    "auth.welcomeBack": "Welcome Back",
    "auth.createAccount": "Create Account",
    "auth.emailAddress": "Email Address",
    "auth.password": "Password",
    "auth.signIn": "Sign In",
    "auth.signUp": "Sign Up",
    "auth.fullName": "Full Name",
    "auth.confirmPassword": "Confirm Password",
    "auth.createAccountButton": "Create Account",
    "auth.alreadyHaveAccount": "Already have an account?",
    "auth.dontHaveAccount": "Don't have an account?",
    "auth.forgotPassword": "Forgot Password?",
    "auth.permissionNeeded": "Permission needed",
    "auth.allowPhotoAccess": "Allow photo access to add a profile picture.",
    "auth.removePhoto": "Remove photo",
    "auth.addProfilePhoto": "Add a profile photo",
    "settings.title": "Settings",
    "settings.account": "ACCOUNT",
    "settings.preferences": "PREFERENCES",
    "settings.latestNotifications": "LATEST NOTIFICATIONS",
    "settings.accountActions": "ACCOUNT ACTIONS",
    "settings.pushNotifications": "Push Notifications",
    "settings.locationServices": "Location Services",
    "settings.darkMode": "Dark Mode",
    "settings.language": "Language",
    "settings.signOut": "Sign Out",
    "settings.deleteAccount": "Delete Account",
    "settings.typeDelete": "Type DELETE to confirm permanent deletion.",
    "settings.delete": "Delete",
    "settings.systemGranted": "Granted",
    "settings.systemDenied": "Denied",
    "settings.systemUnknown": "Unknown",
    "settings.unreadCount": "Unread: {count}",
    "settings.languageEnglish": "English",
    "settings.languageTamil": "Tamil",
    "settings.languageHindi": "Hindi",
    "settings.changeLanguage": "Change Language",
    "settings.languageUpdated": "Language updated",
    "settings.permissionDenied": "Permission denied",
    "settings.enableNotifications": "Enable notifications from system settings.",
    "settings.enableLocation": "Enable location from system settings.",
  },
  ta: {
    "common.cancel": "ரத்து செய்",
    "common.close": "மூடு",
    "common.loading": "ஏற்றுகிறது...",
    "app.tagline": "நகரங்களை மேம்படுத்துவோம்",
    "home.welcomeBack": "மீண்டும் வரவேற்கிறோம்",
    "home.citizen": "குடிமகன்",
    "home.reportIssue": "பிரச்சினை புகார்",
    "home.submitNewComplaint": "புதிய புகாரை பதிவு செய்",
    "home.trackStatus": "நிலை கண்காணிப்பு",
    "home.reportsCount": "{count} புகார்",
    "home.cityMap": "நகர வரைபடம்",
    "home.exploreIssues": "பிரச்சினைகளைப் பார்க்கவும்",
    "home.myReports": "என் புகார்கள்",
    "home.unreadAlerts": "{count} படிக்காத அறிவிப்புகள்",
    "home.empoweringCitizens": "சிறந்த சமூகத்திற்காக குடிமக்களை வலுப்படுத்துதல்",
    "auth.welcomeBack": "மீண்டும் வரவேற்கிறோம்",
    "auth.createAccount": "கணக்கு உருவாக்கவும்",
    "auth.emailAddress": "மின்னஞ்சல் முகவரி",
    "auth.password": "கடவுச்சொல்",
    "auth.signIn": "உள்நுழை",
    "auth.signUp": "பதிவு செய்",
    "auth.fullName": "முழு பெயர்",
    "auth.confirmPassword": "கடவுச்சொல் உறுதிப்படுத்து",
    "auth.createAccountButton": "கணக்கு உருவாக்கு",
    "auth.alreadyHaveAccount": "ஏற்கனவே கணக்கு உள்ளதா?",
    "auth.dontHaveAccount": "கணக்கு இல்லையா?",
    "auth.forgotPassword": "கடவுச்சொல் மறந்துவிட்டதா?",
    "auth.permissionNeeded": "அனுமதி தேவை",
    "auth.allowPhotoAccess": "ப்ரொஃபைல் படத்துக்கு புகைப்பட அணுகலை அனுமதிக்கவும்.",
    "auth.removePhoto": "படத்தை அகற்று",
    "auth.addProfilePhoto": "ப்ரொஃபைல் படம் சேர்க்கவும்",
    "settings.title": "அமைப்புகள்",
    "settings.account": "கணக்கு",
    "settings.preferences": "விருப்பங்கள்",
    "settings.latestNotifications": "சமீப அறிவிப்புகள்",
    "settings.accountActions": "கணக்கு செயல்கள்",
    "settings.pushNotifications": "புஷ் அறிவிப்புகள்",
    "settings.locationServices": "இருப்பிட சேவை",
    "settings.darkMode": "டார்க் மோடு",
    "settings.language": "மொழி",
    "settings.signOut": "வெளியேறு",
    "settings.deleteAccount": "கணக்கை நீக்கு",
    "settings.typeDelete": "நிரந்தரமாக நீக்க DELETE என்று தட்டச்சிடவும்.",
    "settings.delete": "நீக்கு",
    "settings.systemGranted": "அனுமதிக்கப்பட்டது",
    "settings.systemDenied": "மறுக்கப்பட்டது",
    "settings.systemUnknown": "தெரியவில்லை",
    "settings.unreadCount": "படிக்காதது: {count}",
    "settings.languageEnglish": "ஆங்கிலம்",
    "settings.languageTamil": "தமிழ்",
    "settings.languageHindi": "இந்தி",
    "settings.changeLanguage": "மொழியை மாற்று",
    "settings.languageUpdated": "மொழி புதுப்பிக்கப்பட்டது",
    "settings.permissionDenied": "அனுமதி மறுக்கப்பட்டது",
    "settings.enableNotifications": "சிஸ்டம் அமைப்பில் அறிவிப்புகளை இயக்கவும்.",
    "settings.enableLocation": "சிஸ்டம் அமைப்பில் இருப்பிடத்தை இயக்கவும்.",
  },
  hi: {
    "common.cancel": "रद्द करें",
    "common.close": "बंद करें",
    "common.loading": "लोड हो रहा है...",
    "app.tagline": "शहरों को बेहतर बनाना",
    "home.welcomeBack": "वापसी पर स्वागत है",
    "home.citizen": "नागरिक",
    "home.reportIssue": "समस्या रिपोर्ट करें",
    "home.submitNewComplaint": "नई शिकायत दर्ज करें",
    "home.trackStatus": "स्थिति ट्रैक करें",
    "home.reportsCount": "{count} रिपोर्ट",
    "home.cityMap": "सिटी मैप",
    "home.exploreIssues": "समस्याएं देखें",
    "home.myReports": "मेरी रिपोर्ट्स",
    "home.unreadAlerts": "{count} अपठित अलर्ट",
    "home.empoweringCitizens": "बेहतर समुदायों के लिए नागरिकों को सशक्त बनाना",
    "auth.welcomeBack": "फिर से स्वागत है",
    "auth.createAccount": "खाता बनाएं",
    "auth.emailAddress": "ईमेल पता",
    "auth.password": "पासवर्ड",
    "auth.signIn": "साइन इन",
    "auth.signUp": "साइन अप",
    "auth.fullName": "पूरा नाम",
    "auth.confirmPassword": "पासवर्ड पुष्टि करें",
    "auth.createAccountButton": "खाता बनाएं",
    "auth.alreadyHaveAccount": "क्या आपका खाता है?",
    "auth.dontHaveAccount": "खाता नहीं है?",
    "auth.forgotPassword": "पासवर्ड भूल गए?",
    "auth.permissionNeeded": "अनुमति आवश्यक",
    "auth.allowPhotoAccess": "प्रोफाइल फोटो जोड़ने के लिए फोटो एक्सेस दें।",
    "auth.removePhoto": "फोटो हटाएं",
    "auth.addProfilePhoto": "प्रोफाइल फोटो जोड़ें",
    "settings.title": "सेटिंग्स",
    "settings.account": "खाता",
    "settings.preferences": "प्राथमिकताएं",
    "settings.latestNotifications": "नवीनतम सूचनाएं",
    "settings.accountActions": "खाता क्रियाएं",
    "settings.pushNotifications": "पुश नोटिफिकेशन",
    "settings.locationServices": "लोकेशन सेवाएं",
    "settings.darkMode": "डार्क मोड",
    "settings.language": "भाषा",
    "settings.signOut": "साइन आउट",
    "settings.deleteAccount": "खाता हटाएं",
    "settings.typeDelete": "स्थायी हटाने के लिए DELETE लिखें।",
    "settings.delete": "हटाएं",
    "settings.systemGranted": "अनुमति मिली",
    "settings.systemDenied": "अस्वीकृत",
    "settings.systemUnknown": "अज्ञात",
    "settings.unreadCount": "अपठित: {count}",
    "settings.languageEnglish": "अंग्रेज़ी",
    "settings.languageTamil": "तमिल",
    "settings.languageHindi": "हिंदी",
    "settings.changeLanguage": "भाषा बदलें",
    "settings.languageUpdated": "भाषा अपडेट हुई",
    "settings.permissionDenied": "अनुमति अस्वीकृत",
    "settings.enableNotifications": "सिस्टम सेटिंग्स से नोटिफिकेशन चालू करें।",
    "settings.enableLocation": "सिस्टम सेटिंग्स से लोकेशन चालू करें।",
  },
};

const applyParams = (template: string, params?: TranslationParams): string => {
  if (!params) {
    return template;
  }
  return Object.entries(params).reduce((acc, [key, value]) => {
    return acc.replaceAll(`{${key}}`, String(value));
  }, template);
};

export const translate = (
  language: AppLanguage,
  key: TranslationKey,
  params?: TranslationParams
): string => {
  const template = translations[language]?.[key] ?? translations.en[key];
  return applyParams(template, params);
};

export const languageLabel = (language: AppLanguage): string => {
  if (language === "ta") {
    return "Tamil";
  }
  if (language === "hi") {
    return "Hindi";
  }
  return "English";
};

export type { TranslationKey, TranslationParams };
