'use client';

import { useEffect } from 'react';
import { createLogger } from '@/lib/logger';

const log = createLogger('service-worker');

export function ServiceWorkerRegister() {
    useEffect(() => {
        if ('serviceWorker' in navigator) {
            navigator.serviceWorker
                .register('/sw.js')
                .then((registration) => {
                    log.debug('register', 'Service worker registered', { scope: registration.scope });
                })
                .catch((error) => {
                    log.error('register', 'Service worker registration failed', undefined, error);
                });
        }
    }, []);

    return null;
}
