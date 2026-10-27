import axios from 'axios';

const baseURL = import.meta.env.VITE_API_BASE_URL ?? 'http://localhost:4000';

// Access token lives in memory only
let accessToken: string | null = null;

export function setAccessToken(token: string | null) {
  accessToken = token;
}

export function getAccessToken() {
  return accessToken;
}

const api = axios.create({
  baseURL,
  withCredentials: true, // send httpOnly refresh token cookie
});

/**
 * Exchange the httpOnly refresh cookie for a new access token.
 * Uses plain axios so it never passes through the interceptors below.
 */
export async function refreshAccessToken(): Promise<string> {
  const { data } = await axios.post(
    `${baseURL}/api/auth/refresh`,
    {},
    { withCredentials: true }
  );
  setAccessToken(data.accessToken);
  return data.accessToken as string;
}

api.interceptors.request.use((config) => {
  if (accessToken) config.headers.Authorization = `Bearer ${accessToken}`;
  return config;
});

let refreshing: Promise<string> | null = null;

api.interceptors.response.use(
  (res) => res,
  async (error) => {
    const original = error.config;
    const status = error.response?.status;
    const isAuthUrl = typeof original?.url === 'string' && original.url.includes('/api/auth/');

    if (status === 401 && original && !original._retry && !isAuthUrl) {
      original._retry = true;

      if (!refreshing) {
        refreshing = refreshAccessToken().finally(() => {
          refreshing = null;
        });
      }

      try {
        const newToken = await refreshing;
        original.headers.Authorization = `Bearer ${newToken}`;
        return api(original);
      } catch {
        setAccessToken(null);
        localStorage.removeItem('user');
        window.location.href = '/login';
        return Promise.reject(error);
      }
    }

    return Promise.reject(error);
  }
);

export default api;