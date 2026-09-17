// Firebase setup for the chat room.
//
// These values are not secrets. Google hands the same block to every web app
// and expects it in the shipped bundle, which is why it sits in the repo
// rather than in an environment variable: it has to reach the browser
// anyway, and putting it here means no host needs configuring.
//
// What actually protects the data is `firestore.rules`. Read that file if you
// want to know what a stranger with these values can and cannot do. The
// short version: sign in anonymously, read the room, and post one message
// every two seconds with a name under 18 characters and a body under 240.
//
// To fill this in: Firebase console, project settings, the web app, copy the
// firebaseConfig block.

export const CONFIG = {
  apiKey: 'PASTE_YOUR_API_KEY',
  authDomain: 'PASTE.firebaseapp.com',
  projectId: 'PASTE_PROJECT_ID',
  storageBucket: 'PASTE.firebasestorage.app',
  messagingSenderId: 'PASTE_SENDER_ID',
  appId: 'PASTE_APP_ID',
}

// Whether the block above has actually been filled in. Until it is, the chat
// room says it is down, which is true, and the rest of the site is unaffected.
// This is also what keeps the repo building and deployable before anyone has
// touched Firebase.
export const configured = !Object.values(CONFIG).some((v) => String(v).includes('PASTE'))

// The room everything lives under. One room for now; a second would be
// another document here rather than a change anywhere else.
export const ROOM = 'main'
