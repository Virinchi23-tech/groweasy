import { useAuthStore } from '../store/auth';

let API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:5000/api';
if (API_BASE_URL && !API_BASE_URL.endsWith('/api') && !API_BASE_URL.endsWith('/api/')) {
  API_BASE_URL = `${API_BASE_URL.endsWith('/') ? API_BASE_URL.slice(0, -1) : API_BASE_URL}/api`;
}

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

// Decode base64url encoded JWT payload safely on client or server side
const decodeToken = (token: string): any => {
  try {
    const base64Url = token.split('.')[1];
    const base64 = base64Url.replace(/-/g, '+').replace(/_/g, '/');
    const raw = typeof window !== 'undefined'
      ? window.atob(base64)
      : Buffer.from(base64, 'base64').toString('binary');
    const jsonPayload = decodeURIComponent(
      raw
        .split('')
        .map((c) => '%' + ('00' + c.charCodeAt(0).toString(16)).slice(-2))
        .join('')
    );
    return JSON.parse(jsonPayload);
  } catch (e) {
    return null;
  }
};

export const apiFetch = async (endpoint: string, options: RequestOptions = {}): Promise<any> => {
  const url = `${API_BASE_URL}${endpoint}`;
  const headers = new Headers(options.headers || {});

  // Get current access token
  const { accessToken, refreshToken, setAuth, clearAuth } = useAuthStore.getState();

  // Prevent SSR tokenless requests for authenticated paths
  if (typeof window === 'undefined' && !options.skipAuth && !accessToken) {
    throw new Error('Authentication required');
  }

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
          let user = useAuthStore.getState().user;
          
          if (!user) {
            const decoded = decodeToken(data.accessToken);
            if (decoded) {
              user = {
                id: decoded.userId,
                email: decoded.email,
                name: decoded.name,
                role: decoded.role,
              };
            }
          }
          
          if (user) {
            setAuth(data.accessToken, data.refreshToken, user);
          } else {
            useAuthStore.setState({ accessToken: data.accessToken, refreshToken: data.refreshToken });
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
      subscribeTokenRefresh(() => {
        resolve(apiFetch(endpoint, options));
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
