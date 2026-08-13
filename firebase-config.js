// Firebase project configuration for Wird.
//
// Reuses the same Firebase project as Muḥkam and Flow — Firestore data is
// namespaced per app under apps/{appId}/users/{uid}, and the security
// rules already generically cover any appId, so no new Firebase Console
// setup is needed for this app.
//
// These values are not secret — they identify the project to Firebase's
// client SDK. Real access control lives in Firestore Security Rules, not
// in hiding this file.
window.FIREBASE_CONFIG = {
  apiKey: "AIzaSyDnZQCyd_LfNZT7ndtrJwNXIPkStf9iAbs",
  authDomain: "nablyudatel-9817a.firebaseapp.com",
  projectId: "nablyudatel-9817a",
  storageBucket: "nablyudatel-9817a.firebasestorage.app",
  messagingSenderId: "495498428484",
  appId: "1:495498428484:web:38ea6877f6d1708e75bc11",
};
