import { useEffect } from 'react';
import { Page } from '../types';

/**
 * Handles Android hardware back button via popstate.
 * Capacitor bridges the back button as a popstate event.
 */
export function useAndroidBack(currentPage: Page, onBack: () => void) {
  useEffect(() => {
    // Push a state so we can intercept back
    window.history.pushState({ page: currentPage }, '');

    const handler = (e: PopStateEvent) => {
      e.preventDefault();
      onBack();
      // Re-push so next back press also works
      window.history.pushState({ page: currentPage }, '');
    };

    window.addEventListener('popstate', handler);
    return () => window.removeEventListener('popstate', handler);
  }, [currentPage, onBack]);
}
