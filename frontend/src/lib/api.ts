import axios from 'axios';

/** One axios client. The dev server proxies /api to the Express app. */
export const api = axios.create({ baseURL: '/api' });

const TOKEN_KEY = 'globetrotter.token';

export const getToken = () => {
  try { return localStorage.getItem(TOKEN_KEY); } catch { return null; }
};

export const setToken = (token: string | null) => {
  try {
    if (token) localStorage.setItem(TOKEN_KEY, token);
    else localStorage.removeItem(TOKEN_KEY);
  } catch { /* private browsing */ }
};

api.interceptors.request.use((config) => {
  const token = getToken();
  if (token) config.headers.Authorization = `Bearer ${token}`;
  return config;
});

/** Turn any failure into the sentence the interface should show. */
export function errorText(err: unknown): string {
  if (axios.isAxiosError(err)) {
    if (err.response?.data?.error) return err.response.data.error as string;
    if (err.code === 'ERR_NETWORK') return 'The server is not responding. Is the API running on port 4000?';
  }
  return 'Something went wrong. Try that again.';
}
