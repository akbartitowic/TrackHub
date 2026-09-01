import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import { getApiUrl } from '../services/api';

const DEFAULT_LOGO = '/logo.png';
const DEFAULT_FAVICON = '/favicon.png';
const DEFAULT_APP_NAME = 'Noohtify';
const DEFAULT_APP_TAGLINE = 'Software Management';

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

export function AppBrandingProvider({ children }) {
    const [branding, setBranding] = useState({
        app_name: DEFAULT_APP_NAME,
        app_tagline: DEFAULT_APP_TAGLINE,
        logo_url: DEFAULT_LOGO,
        favicon_url: DEFAULT_FAVICON,
        has_custom_logo: false,
        has_custom_favicon: false,
    });
    const [loading, setLoading] = useState(true);

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
                    logo_url: data.data.logo_url || DEFAULT_LOGO,
                    favicon_url: data.data.favicon_url || DEFAULT_FAVICON,
                    has_custom_logo: Boolean(data.data.has_custom_logo),
                    has_custom_favicon: Boolean(data.data.has_custom_favicon),
                };
                setBranding(next);
                applyFavicon(next.favicon_url);
                return next;
            }
        } catch (err) {
            console.error('Failed to load branding', err);
        }
        return null;
    }, []);

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
