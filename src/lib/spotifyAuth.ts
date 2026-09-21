export const SPOTIFY_CLIENT_ID_KEY = 'aralko-spotify-client-id';
export const SPOTIFY_ACCESS_TOKEN_KEY = 'aralko-spotify-access-token';
export const SPOTIFY_REFRESH_TOKEN_KEY = 'aralko-spotify-refresh-token';
export const SPOTIFY_EXPIRES_AT_KEY = 'aralko-spotify-expires-at';

const REDIRECT_URI = import.meta.env.VITE_SPOTIFY_REDIRECT_URI || window.location.origin;

const generateRandomString = (length: number) => {
  const possible = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
  const values = crypto.getRandomValues(new Uint8Array(length));
  return values.reduce((acc, x) => acc + possible[x % possible.length], "");
};

const sha256 = async (plain: string) => {
  const encoder = new TextEncoder();
  const data = encoder.encode(plain);
  return window.crypto.subtle.digest('SHA-256', data);
};

const base64encode = (input: ArrayBuffer) => {
  return btoa(String.fromCharCode(...new Uint8Array(input)))
    .replace(/=/g, '')
    .replace(/\+/g, '-')
    .replace(/\//g, '_');
};

export const initiateSpotifyLogin = async (clientId: string) => {
  const codeVerifier = generateRandomString(64);
  const hashed = await sha256(codeVerifier);
  const codeChallenge = base64encode(hashed);

  window.localStorage.setItem('spotify_code_verifier', codeVerifier);

  const scope = [
    'streaming',
    'user-read-email',
    'user-read-private',
    'user-modify-playback-state',
    'user-read-playback-state',
    'playlist-read-private',
    'playlist-read-collaborative'
  ].join(' ');

  const authUrl = new URL("https://accounts.spotify.com/authorize");
  const params = {
    response_type: 'code',
    client_id: clientId,
    scope,
    code_challenge_method: 'S256',
    code_challenge: codeChallenge,
    redirect_uri: REDIRECT_URI,
  };

  authUrl.search = new URLSearchParams(params).toString();
  window.location.href = authUrl.toString();
};

export const handleSpotifyCallback = async (clientId: string, code: string) => {
  const codeVerifier = window.localStorage.getItem('spotify_code_verifier');
  
  if (!codeVerifier) {
    throw new Error("No code verifier found");
  }

  const payload = {
    method: 'POST',
    headers: {
      'Content-Type': 'application/x-www-form-urlencoded',
    },
    body: new URLSearchParams({
      client_id: clientId,
      grant_type: 'authorization_code',
      code,
      redirect_uri: REDIRECT_URI,
      code_verifier: codeVerifier,
    }),
  };

  const body = await fetch("https://accounts.spotify.com/api/token", payload);
  const response = await body.json();

  if (response.access_token) {
    window.localStorage.setItem(SPOTIFY_ACCESS_TOKEN_KEY, response.access_token);
    window.localStorage.setItem(SPOTIFY_REFRESH_TOKEN_KEY, response.refresh_token);
    window.localStorage.setItem(SPOTIFY_EXPIRES_AT_KEY, (Date.now() + response.expires_in * 1000).toString());
    window.localStorage.removeItem('spotify_code_verifier');
    return true;
  }
  
  throw new Error(response.error_description || 'Failed to get token');
};

export const refreshSpotifyToken = async (clientId: string) => {
  const refreshToken = window.localStorage.getItem(SPOTIFY_REFRESH_TOKEN_KEY);
  if (!refreshToken) return null;

  const payload = {
    method: 'POST',
    headers: {
      'Content-Type': 'application/x-www-form-urlencoded'
    },
    body: new URLSearchParams({
      grant_type: 'refresh_token',
      refresh_token: refreshToken,
      client_id: clientId
    }),
  };

  try {
    const body = await fetch("https://accounts.spotify.com/api/token", payload);
    const response = await body.json();

    if (response.access_token) {
      window.localStorage.setItem(SPOTIFY_ACCESS_TOKEN_KEY, response.access_token);
      window.localStorage.setItem(SPOTIFY_EXPIRES_AT_KEY, (Date.now() + response.expires_in * 1000).toString());
      if (response.refresh_token) {
        window.localStorage.setItem(SPOTIFY_REFRESH_TOKEN_KEY, response.refresh_token);
      }
      return response.access_token;
    }
  } catch (e) {
    console.error('Error refreshing token', e);
  }
  
  window.localStorage.removeItem(SPOTIFY_ACCESS_TOKEN_KEY);
  window.localStorage.removeItem(SPOTIFY_REFRESH_TOKEN_KEY);
  window.localStorage.removeItem(SPOTIFY_EXPIRES_AT_KEY);
  return null;
};

