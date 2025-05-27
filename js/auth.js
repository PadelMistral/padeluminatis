// auth.js
import { getAuth, onAuthStateChanged } from "https://www.gstatic.com/firebasejs/11.7.3/firebase-auth.js";
import { auth } from './firebase-config.js';

export function initAuth() {
  onAuthStateChanged(auth, user => {
    if (!user) {
      window.location.href = "index.html";
    }
  });
}