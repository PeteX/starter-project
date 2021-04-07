import appConfig from '../config.json';

interface ServerConfig {
  authorization_endpoint: string;
  token_endpoint: string;
  end_session_endpoint: string;
}

interface TokenResponse {
  access_token: string;
  expires_in: number;
  id_token: string;
  refresh_token: string;
  refresh_expires_in: number;
}

let prefix: string;
let claims: string;
let authListeners = new Map<number, () => void>();
let authListenerId = 0;
let currentUser: string = null;
let oidcServerConfig: ServerConfig = null;
let initialRenewalDone = false;

let base = (document.location.origin + document.location.pathname).replace(/\/[^/]*$/, '');
if(document.querySelector('base')) base = document.querySelector('base').href.replace(/\/$/, '');

export function getCurrentUser() {
  return currentUser;
}

export async function getAccessToken() {
  if(!tokenStillValid('access') && tokenStillValid('refresh'))
    await renewTokens(false);

  let token = localStorage.getItem(`${prefix}.oidc.access_token`);
  return token && tokenStillValid('access') ? token : null;
}

export function addAuthListener(handler: () => void) {
  authListeners.set(authListenerId, handler);
  return authListenerId++;
}

export function removeAuthListener(id: number) {
  authListeners.delete(id);
}

function callAuthListeners() {
  authListeners.forEach(listener => listener());
}

function getTokenContents(token: string) {
  token = token.split('.')[1];
  token = token.replace(/-/g, '+').replace(/_/g, '/');
  token = atob(token);
  return JSON.parse(token);
}

function tokenStillValid(token: string) {
  let expiry = parseInt(localStorage.getItem(`${prefix}.oidc.${token}_token_expiry`));

  // Allow 60 seconds to reduce the likelihood of problems with clock skew.
  return expiry && expiry > Date.now() / 1000 + 60;
}

function base64URLEncode(str: Uint8Array) {
  return btoa(Array.from(str).map(x => String.fromCharCode(x)).join(''))
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=/g, '');
}

async function sha256(data: string) {
  let buffer = new Uint8Array(Array.from(data).map(x => x.charCodeAt(0)));
  let digest = await crypto.subtle.digest('SHA-256', buffer);
  return base64URLEncode(new Uint8Array(digest));
}

async function getConfig() {
  if(oidcServerConfig)
    return oidcServerConfig;

  let newConfig = await fetch(appConfig.oidcServer);
  oidcServerConfig = await newConfig.json();
  return oidcServerConfig;
}

function clearTokens() {
  localStorage.removeItem(`${prefix}.oidc.tokens_received`);
  localStorage.removeItem(`${prefix}.oidc.access_token`);
  localStorage.removeItem(`${prefix}.oidc.access_token_expiry`);
  localStorage.removeItem(`${prefix}.oidc.refresh_token`);
  localStorage.removeItem(`${prefix}.oidc.refresh_token_expiry`);
  localStorage.removeItem(`${prefix}.oidc.id_token`);
  currentUser = null;
}

function storeTokens(tokens: TokenResponse, scheduleRenewal: boolean) {
  if(!tokens.access_token || !tokens.refresh_token || !tokens.id_token) {
    clearTokens();
    callAuthListeners();
    return;
  }

  localStorage.setItem(`${prefix}.oidc.tokens_received`, String(Date.now() / 1000));
  localStorage.setItem(`${prefix}.oidc.access_token`, tokens.access_token);
  localStorage.setItem(`${prefix}.oidc.access_token_expiry`, String(Date.now() / 1000 + tokens.expires_in));
  localStorage.setItem(`${prefix}.oidc.refresh_token`, tokens.refresh_token);

  // KeyCloak and the custom identity server include a non-standard field called refresh_expires_in, which gives the
  // expiry time for the refresh token.  There is no good alternative to using this field.  If the refresh token is a
  // JWT, it can be parsed and the expiry time extracted, but the format is not specified.
  //
  // If this field is not present, we assume the refresh token expires in a day.  There is no option besides guesswork.

  let refresh_expiry = tokens.refresh_expires_in || 24 * 60 * 60;
  localStorage.setItem(`${prefix}.oidc.refresh_token_expiry`, String(Date.now() / 1000 + refresh_expiry));

  localStorage.setItem(`${prefix}.oidc.id_token`, tokens.id_token);
  let idToken = getTokenContents(tokens.id_token);
  currentUser = idToken.sub;

  if(scheduleRenewal)
    // No "await".  This promise never fully completes because at the end it will simply schedule the next refresh.
    scheduleTokenRenewal();
}

async function renewTokens(scheduleRenewal: boolean) {
  let config = await getConfig();

  let tokenParams = new URLSearchParams();
  tokenParams.append('grant_type', 'refresh_token');
  tokenParams.append('client_id', appConfig.oidcClientId);
  tokenParams.append('refresh_token', localStorage.getItem(`${prefix}.oidc.refresh_token`));

  let token = await fetch(config.token_endpoint, {
    method: 'POST',
    headers: {'Content-Type': 'application/x-www-form-urlencoded'},
    body: tokenParams.toString()
  });

  let tokenResponse: TokenResponse = await token.json();
  storeTokens(tokenResponse, scheduleRenewal);
}

async function scheduleTokenRenewal() {
  let received = parseInt(localStorage.getItem(`${prefix}.oidc.tokens_received`));
  let expiry = parseInt(localStorage.getItem(`${prefix}.oidc.refresh_token_expiry`));

  if(initialRenewalDone) {
    // Refresh when half the validity period has gone.  If the user leaves and comes back, it would be helpful if there
    // were some time remaining on the token, to allow them to be logged back in straightforwardly.
    let refreshDelay = (expiry - received) / 2;
    if(refreshDelay < 30) refreshDelay = 30;
    await new Promise(resolve => setTimeout(resolve, refreshDelay * 1000));
  } else {
    // When the page is first loaded, the token should be renewed immediately.  This catches the case where the user has
    // been logged out the OIDC server, but the credentials are still cached for this application.
    initialRenewalDone = true;
  }
  await renewTokens(true);
}

export async function oidcInit(prefixParam: string, claimsParam: string) {
  prefix = prefixParam;
  claims = claimsParam;

  let path = document.location.pathname;
  if(path.match(/.*\/oidc\.html$/)) {
    let config = await getConfig();
    let urlParams = new URLSearchParams(window.location.search);

    if(urlParams.get('state') === localStorage.getItem(`${prefix}.oidc.state`)) {
      let tokenParams = new URLSearchParams();
      tokenParams.append('grant_type', 'authorization_code');
      tokenParams.append('code', urlParams.get('code'));
      tokenParams.append('client_id', appConfig.oidcClientId);
      tokenParams.append('redirect_uri', `${base}/oidc.html`);
      tokenParams.append('code_verifier', localStorage.getItem(`${prefix}.oidc.verifier`));

      let token = await fetch(config.token_endpoint, {
        method: 'POST',
        headers: {'Content-Type': 'application/x-www-form-urlencoded'},
        body: tokenParams.toString()
      });

      let tokenResponse: TokenResponse = await token.json();
      storeTokens(tokenResponse, false);
    }

    let redirect = sessionStorage.getItem(`${prefix}.oidc.saved_url`);
    sessionStorage.removeItem(`${prefix}.oidc.saved_url`);
    redirect = redirect || base;
    document.location.replace(redirect);
    return true;
  } else {
    // If the refresh token has expired (or doesn't exist) we need to redirect to the identity server's login screen,
    // rather than just asking for a token.  It's possible the user already has a session on the identity server, so
    // does not need to be prompted.  In this case it makes sense to do the login automatically rather than waiting for
    // the user to request it.
    //
    // We don't check the session more than once every minute, mainly to avoid an infinite loop (identity server returns
    // the user with an indication of no session, but we then ask again).  It also makes sense simply to avoid delay,
    // because it's unlikely the user will have logged in somewhere else in such a short time.
    let sessionCheck = parseInt(localStorage.getItem(`${prefix}.oidc.last_session_check`)) || 0;
    if(!tokenStillValid('refresh') && sessionCheck + 60 < Date.now() / 1000) {
      localStorage.setItem(`${prefix}.oidc.last_session_check`, String(Math.round(Date.now() / 1000)));
      await oidcSignIn(false);
      return true;
    }
  }

  return false;
}

export async function oidcLoadTokens() {
  let idToken = localStorage.getItem(`${prefix}.oidc.id_token`);
  let accessTokenValid = false;
  if(idToken && tokenStillValid('access')) {
    let idTokenContent = getTokenContents(idToken);
    currentUser = idTokenContent.sub;
    accessTokenValid = true;
  }

  let refreshToken = localStorage.getItem(`${prefix}.oidc.refresh_token`);
  if(refreshToken && tokenStillValid('refresh')) {
    let renewal = scheduleTokenRenewal();

    // We always renew the tokens on initial page load, to catch the case where the session has been cancelled with the
    // OIDC server for example.  If the access token has expired but the refresh token has not, we also need to wait for
    // the renewal to complete.  If we don't, the auth listeners will be called twice (once with the user not logged on,
    // the next with them logged on once the renewal completes).
    //
    // It might seem that quicker progress could be made by using the expired access token initially, but this is not
    // the case.  As soon as the system tries to make an API call, the access token will have to be renewed anyway.
    //
    // Note that the access token is opaque, so the currentUser is read from the ID token.

    if(!accessTokenValid)
      await renewal;
  }

  callAuthListeners();
}

export async function oidcSignIn(prompt = true) {
  let config = await getConfig();
  let verifier = new Uint8Array(32);
  crypto.getRandomValues(verifier);
  let verifierStr = base64URLEncode(verifier);
  localStorage.setItem(`${prefix}.oidc.verifier`, verifierStr);
  let challenge = await sha256(verifierStr);

  let state = new Uint8Array(32);
  crypto.getRandomValues(state);
  let stateStr = base64URLEncode(state);
  localStorage.setItem(`${prefix}.oidc.state`, stateStr);

  let params = new URLSearchParams();
  params.append('response_type', 'code');
  params.append('scope', claims);
  params.append('client_id', appConfig.oidcClientId);
  params.append('state', stateStr);
  params.append('code_challenge', challenge);
  params.append('code_challenge_method', 'S256');
  params.append('redirect_uri', `${base}/oidc.html`);
  if(!prompt) params.append('prompt', 'none');
  let paramsStr = params.toString();

  sessionStorage.setItem(`${prefix}.oidc.saved_url`, document.location.href);
  document.location.href = `${config.authorization_endpoint}?${paramsStr}`;
}

export async function oidcSignOut() {
  let config = await getConfig();
  let params = new URLSearchParams();
  params.append('client_id', appConfig.oidcClientId);
  params.append('id_token_hint', localStorage.getItem(`${prefix}.oidc.id_token`));
  params.append('redirect_uri', `${base}/oidc.html`);
  params.append('post_logout_redirect_uri', `${base}/oidc.html`);
  params.append('refresh_token', localStorage.getItem(`${prefix}.oidc.refresh_token`));
  let paramsStr = params.toString();

  clearTokens();
  document.location.href = `${config.end_session_endpoint}?${paramsStr}`;
}

export function getClaim(claim: string) {
  let idToken = localStorage.getItem(`${prefix}.oidc.id_token`);
  let idTokenContents = idToken ? getTokenContents(idToken) : {};
  return idTokenContents[claim];
}

export function editAccountDetails() {
  let params = new URLSearchParams();
  params.append('referrer', appConfig.oidcClientId);
  params.append('referrer_uri', `${base}/oidc.html`);
  let paramsStr = params.toString();

  document.location.href = `${appConfig.accountUrl}?${paramsStr}`;
}
