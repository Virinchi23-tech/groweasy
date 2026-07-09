import { useAuthStore } from '../store/auth';

const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:5000/api';

interface RequestOptions extends RequestInit {
  skipAuth?: boolean;
}

let isRefreshing = false;
let refreshSubscribers: ((token: string) => void)[] = [];

const subscribeTokenRefresh = (cb: (token: string) => void) => {
  refreshSubscribers.push(cb);
};

const onRefreshed = (token: string) => {
  refreshSubscribers.forEach((cb) => cb(token));
  refreshSubscribers = [];
};

export const apiFetch = async (endpoint: string, options: RequestOptions = {}): Promise<any> => {
  const url = `${API_BASE_URL}${endpoint}`;
  const headers = new Headers(options.headers || {});

  // Get current access token
  const { accessToken, refreshToken, setAuth, clearAuth } = useAuthStore.getState();

  if (accessToken && !options.skipAuth) {
    headers.set('Authorization', `Bearer ${accessToken}`);
  }

  // Set Content-Type default (do not set if body is FormData for Multer)
  if (!(options.body instanceof FormData) && !headers.has('Content-Type')) {
    headers.set('Content-Type', 'application/json');
  }

  const response = await fetch(url, {
    ...options,
    headers,
  });

  // Handle Token Refresh rotation on 401
  if (response.status === 401 && refreshToken && !options.skipAuth) {
    if (!isRefreshing) {
      isRefreshing = true;

      try {
        const refreshResponse = await fetch(`${API_BASE_URL}/auth/refresh`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ refreshToken }),
        });

        if (refreshResponse.ok) {
          const data = await refreshResponse.json();
          const user = useAuthStore.getState().user;
          
          if (user) {
            setAuth(data.accessToken, data.refreshToken, user);
          }
          
          isRefreshing = false;
          onRefreshed(data.accessToken);
        } else {
          isRefreshing = false;
          clearAuth();
          if (typeof window !== 'undefined') {
            window.location.href = '/login?session_expired=true';
          }
          throw new Error('Session expired');
        }
      } catch (err) {
        isRefreshing = false;
        clearAuth();
        throw err;
      }
    }

    // Wait for the refresh token promise to resolve
    return new Promise((resolve) => {
      subscribeTokenRefresh((newToken) => {
        headers.set('Authorization', `Bearer ${newToken}`);
        resolve(
          fetch(url, {
            ...options,
            headers,
          }).then((res) => {
            if (!res.ok) {
              return res.json().then(e => Promise.reject(e));
            }
            return res.json();
          })
        );
      });
    });
  }

  if (!response.ok) {
    const errorData = await response.json().catch(() => ({ error: 'Request failed' }));
    throw new Error(errorData.error || 'API Request failed');
  }

  // Support file streams/blobs (e.g. CSV downloads)
  const contentType = response.headers.get('Content-Type');
  if (contentType && contentType.includes('text/csv')) {
    return response.blob();
  }

  return response.json();
};
