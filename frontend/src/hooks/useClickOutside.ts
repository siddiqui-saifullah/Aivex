import { useEffect, useRef, type RefObject } from 'react';

/**
 * Hook to detect clicks outside a ref element
 * Useful for closing menus, modals, dropdowns
 */
export const useClickOutside = (ref: RefObject<HTMLElement | null>, callback: () => void) => {
    // Keep the latest callback without re-subscribing on every render
    const callbackRef = useRef(callback);
    useEffect(() => {
        callbackRef.current = callback;
    }, [callback]);

    useEffect(() => {
        const handleClickOutside = (event: MouseEvent) => {
            if (ref.current && !ref.current.contains(event.target as Node)) {
                callbackRef.current();
            }
        };

        document.addEventListener('mousedown', handleClickOutside);
        return () => {
            document.removeEventListener('mousedown', handleClickOutside);
        };
    }, [ref]);
};
