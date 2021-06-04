import { initializeApp } from 'firebase/app'
import { getAuth, signInWithCustomToken, signOut } from 'firebase/auth';
import 'firebase/firestore';

import { html, unsafeCSS, LitElement } from 'lit';

import appConfig from '../config.json';

import './document.less';
import styles from './app.less';

import './rpc';

import { oidcInit, oidcLoadTokens, getAccessToken, addAuthListener, getCurrentUser, oidcSignIn, oidcSignOut,
  editAccountDetails } from './oidc';

let signInComplete: () => void;
export let signInProgress: Promise<void> = new Promise(resolve => signInComplete = resolve);

class App extends LitElement {
  static styles = unsafeCSS(styles);

  render() {
    return html`
      <p>The quick brown fox jumped over the lazy dog.</p>

      <app-rpc></app-rpc>

      <div id=buttons>
        ${getCurrentUser() ? html`
          <button class=button @click=${oidcSignOut}>Sign Out</button>
          <button class=button @click=${editAccountDetails}>Account</button>
        ` : html`
          <button class=button @click=${oidcSignIn}>Sign In</button>
        `}
      </div>
    `;
  }
}

if(process.env.SERVICE_WORKER === 'yes') {
  if('serviceWorker' in navigator) {
    window.addEventListener('load', () => {
      navigator.serviceWorker.register('./sw.js');
    });
  }
}

const app = initializeApp({
  apiKey: appConfig.firebaseApiKey,
  databaseURL: `https://${appConfig.firebaseProjectId}.firebaseio.com`,
  projectId: appConfig.firebaseProjectId
});

const auth = getAuth(app);

async function authListener() {
  let token = await getAccessToken();
  if(token) {
    let response = await fetch('https://extfirebase-nz3lbnk6qa-uc.a.run.app/key', {
      headers: {
        Authorization: `bearer ${token}`
      }
    });

    let json = await response.json();
    await signInWithCustomToken(auth, json.key);
  } else {
    await signOut(auth);
  }

  signInComplete();
}

let urlParams = new URLSearchParams(window.location.search);
if(urlParams.has('r')) {
  localStorage.setItem('starter-app.referrer', urlParams.get('r'));
  location.href = location.origin + location.pathname;
} else {
  oidcInit('starter-app', 'openid email profile starter-app').then(async handled => {
    if(!handled) {
      // Reload the page when a tab is reactivated, to avoid stale versions of the client code getting left on client
      // devices.  This is a particular issue with mobiles, where the browser generally gets deactivated rather than
      // closed.
      let lastReload = Date.now();
      document.addEventListener('visibilitychange', () => {
        if(document.visibilityState === 'visible' && lastReload + 12 /* hours */ * 60 * 60 * 1000 < Date.now())
          document.location.reload();
      });

      addAuthListener(authListener);
      await oidcLoadTokens();
      customElements.define('app-root', App);
    }
  });
}
