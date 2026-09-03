import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import { getApiUrl } from '../services/api';

const DEFAULT_LOGO = '/logo.png';
const DEFAULT_FAVICON = '/favicon.png';
const DEFAULT_APP_NAME = 'MyActivity';
const DEFAULT_APP_TAGLINE = 'Software Management';
const DEFAULT_LOGIN_TITLE = 'MyActivity';
const DEFAULT_LOGIN_SUBTITLE = 'Task management connected to your world.';

const AppBrandingContext = createContext(null);

function applyFavicon(url) {
    if (!url || typeof document === 'undefined') return;
    let link = document.querySelector("link[rel~='icon']");
    if (!link) {
        link = document.createElement('link');
        link.rel = 'icon';
        document.head.appendChild(link);
    }
    link.type = 'image/png';
    link.href = url;
}

function getInitialBranding() {
    try {
        const cached = localStorage.getItem('app_branding_cache');
        if (cached) {
            const parsed = JSON.parse(cached);
            return {
                app_name: parsed.app_name || DEFAULT_APP_NAME,
                app_tagline: parsed.app_tagline || DEFAULT_APP_TAGLINE,
                login_title: parsed.login_title || DEFAULT_LOGIN_TITLE,
                login_subtitle: parsed.login_subtitle || DEFAULT_LOGIN_SUBTITLE,
                logo_url: parsed.logo_url || DEFAULT_LOGO,
                favicon_url: parsed.favicon_url || DEFAULT_FAVICON,
                has_custom_logo: Boolean(parsed.has_custom_logo),
                has_custom_favicon: Boolean(parsed.has_custom_favicon),
            };
        }
    } catch (_) {}
    return {
        app_name: DEFAULT_APP_NAME,
        app_tagline: DEFAULT_APP_TAGLINE,
        login_title: DEFAULT_LOGIN_TITLE,
        login_subtitle: DEFAULT_LOGIN_SUBTITLE,
        logo_url: DEFAULT_LOGO,
        favicon_url: DEFAULT_FAVICON,
        has_custom_logo: false,
        has_custom_favicon: false,
    };
}

export function AppBrandingProvider({ children }) {
    const [branding, setBrandingState] = useState(getInitialBranding);
    const [loading, setLoading] = useState(true);

    const setBranding = useCallback((updater) => {
        setBrandingState((prev) => {
            const next = typeof updater === 'function' ? updater(prev) : updater;
            try {
                localStorage.setItem('app_branding_cache', JSON.stringify(next));
            } catch (_) {}
            applyFavicon(next.favicon_url);
            return next;
        });
    }, []);

    const refreshBranding = useCallback(async () => {
        try {
            const response = await fetch(`${getApiUrl()}/branding`, {
                headers: { Accept: 'application/json' },
            });
            const data = await response.json().catch(() => ({}));
            if (response.ok && data?.data) {
                const next = {
                    app_name: data.data.app_name || DEFAULT_APP_NAME,
                    app_tagline: data.data.app_tagline || DEFAULT_APP_TAGLINE,
                    login_title: data.data.login_title || data.data.app_name || DEFAULT_LOGIN_TITLE,
                    login_subtitle: data.data.login_subtitle || DEFAULT_LOGIN_SUBTITLE,
                    logo_url: data.data.logo_url || DEFAULT_LOGO,
                    favicon_url: data.data.favicon_url || DEFAULT_FAVICON,
                    has_custom_logo: Boolean(data.data.has_custom_logo),
                    has_custom_favicon: Boolean(data.data.has_custom_favicon),
                };
                setBranding(next);
                return next;
            }
        } catch (err) {
            console.error('Failed to load branding', err);
        }
        return null;
    }, [setBranding]);

    useEffect(() => {
        let cancelled = false;
        (async () => {
            await refreshBranding();
            if (!cancelled) setLoading(false);
        })();
        return () => {
            cancelled = true;
        };
    }, [refreshBranding]);

    const value = useMemo(
        () => ({
            ...branding,
            loading,
            refreshBranding,
            setBranding,
        }),
        [branding, loading, refreshBranding],
    );

    return (
        <AppBrandingContext.Provider value={value}>
            {children}
        </AppBrandingContext.Provider>
    );
}

export function useAppBranding() {
    const ctx = useContext(AppBrandingContext);
    if (!ctx) {
        return {
            logo_url: DEFAULT_LOGO,
            favicon_url: DEFAULT_FAVICON,
            has_custom_logo: false,
            has_custom_favicon: false,
            loading: false,
            refreshBranding: async () => null,
            setBranding: () => {},
        };
    }
    return ctx;
}
