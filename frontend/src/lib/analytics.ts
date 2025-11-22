export type AnalyticsPayload = Record<string, unknown> | undefined;

export const trackEvent = (name: string, payload?: AnalyticsPayload) => {
    if (typeof window === 'undefined') return;
    const detail = {
        name,
        payload,
        timestamp: Date.now(),
    };
    window.dispatchEvent(new CustomEvent('analytics:event', { detail }));
    if (import.meta.env.DEV) {
        // eslint-disable-next-line no-console
        console.debug('[analytics]', detail);
    }
};
