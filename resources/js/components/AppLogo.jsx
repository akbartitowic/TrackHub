import { useState, useEffect } from 'react';
import { useAppBranding } from '../context/AppBrandingContext';
import { cn } from '@/lib/utils';

export default function AppLogo({ className, alt = 'Application logo' }) {
    const { logo_url: logoUrl } = useAppBranding();
    const [imgSrc, setImgSrc] = useState(logoUrl || '/logo.png');

    useEffect(() => {
        setImgSrc(logoUrl || '/logo.png');
    }, [logoUrl]);

    return (
        <img
            src={imgSrc}
            alt={alt}
            onError={() => {
                if (imgSrc !== '/logo.png') {
                    setImgSrc('/logo.png');
                }
            }}
            className={cn('object-contain', className)}
        />
    );
}
