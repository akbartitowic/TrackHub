import { RATE_LIMIT_EVENT } from '../components/RateLimitToast';

// Most callers still fall back to native `alert(err.message)` on failure (this codebase
// has no toast system). For 429s we already show a design-matched toast below, so briefly
// shadow window.alert to avoid stacking a plain browser alert on top of it.
let alertSuppressedUntil = 0;
if (typeof window !== 'undefined' && !window.__hubtaskAlertPatched) {
    window.__hubtaskAlertPatched = true;
    const originalAlert = window.alert.bind(window);
    window.alert = (msg) => {
        if (Date.now() < alertSuppressedUntil) return;
        originalAlert(msg);
    };
}

function notifyRateLimited(message, retryAfter) {
    if (typeof window === 'undefined') return;
    alertSuppressedUntil = Date.now() + 800;
    window.dispatchEvent(
        new CustomEvent(RATE_LIMIT_EVENT, { detail: { message, retryAfter: Number(retryAfter) || 0 } })
    );
}

function normalizeApiBase() {
    const raw =
        (typeof import.meta !== 'undefined' && import.meta.env?.VITE_API_URL) || '/api';
    const s = String(raw).trim();
    if (!s) {
        return '/api';
    }
    return s.replace(/\/$/, '');
}

function normalizeEndpoint(endpoint) {
    const ep = String(endpoint ?? '').trim();
    if (!ep) {
        throw new Error('fetchAPI: endpoint is required');
    }
    // Always root-absolute so fetch never resolves relative to /sales/pitch/...
    return ep.startsWith('/') ? ep : `/${ep}`;
}

/** Base URL for API (no trailing slash), e.g. `/api` or full URL from VITE_API_URL */
export const API_BASE = normalizeApiBase();

export const getApiUrl = () => normalizeApiBase();

export async function fetchAPI(endpoint, options = {}) {
    const token = localStorage.getItem('auth_token');
    const base = normalizeApiBase();
    const path = normalizeEndpoint(endpoint);
    const url = /^https?:\/\//i.test(base) ? `${base}${path}` : `${base}${path}`;

    try {
        const response = await fetch(url, {
            ...options,
            credentials: 'omit',
            headers: {
                Accept: 'application/json',
                'Content-Type': 'application/json',
                ...(token ? { Authorization: `Bearer ${token}` } : {}),
                ...options.headers,
            },
        });

        if (response.status === 401 && !endpoint.includes('/login')) {
            localStorage.removeItem('auth_token');
            window.location.href = '/login';
            return;
        }

        if (!response.ok) {
            const errorData = await response.json().catch(() => ({}));
            let message = errorData.message ?? errorData.error;
            if (message != null && typeof message === 'object') {
                message = JSON.stringify(message);
            }
            if (!message && errorData.errors && typeof errorData.errors === 'object') {
                message = Object.values(errorData.errors)
                    .flat()
                    .filter(Boolean)
                    .join(' ');
            }
            if (!message) {
                message = `API error: ${response.status} ${response.statusText}`;
            }
            if (
                response.status === 405 &&
                typeof message === 'string' &&
                message.includes('method is not supported')
            ) {
                message +=
                    ' Make sure the request targets a URL with the /api prefix (not a React page path like /sales/pitch/...).';
            }
            if (response.status === 429) {
                const retryAfter =
                    errorData.retry_after ?? Number(response.headers.get('Retry-After')) ?? 0;
                notifyRateLimited(message, retryAfter);
            }
            throw new Error(message);
        }

        return await response.json();
    } catch (error) {
        console.error('Fetch error:', error);
        throw error;
    }
}
