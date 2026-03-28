/**
 * Haptic feedback — uses Capacitor Haptics if available,
 * falls back to navigator.vibrate on web.
 */
export function useHaptic() {
  const light = () => {
    try {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const cap = (window as any).Capacitor;
      if (cap?.isNativePlatform()) {
        import('@capacitor/haptics').then(({ Haptics, ImpactStyle }) => {
          Haptics.impact({ style: ImpactStyle.Light });
        }).catch(() => {});
      } else if (navigator.vibrate) {
        navigator.vibrate(10);
      }
    } catch { /* ignore */ }
  };

  const medium = () => {
    try {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const cap = (window as any).Capacitor;
      if (cap?.isNativePlatform()) {
        import('@capacitor/haptics').then(({ Haptics, ImpactStyle }) => {
          Haptics.impact({ style: ImpactStyle.Medium });
        }).catch(() => {});
      } else if (navigator.vibrate) {
        navigator.vibrate(20);
      }
    } catch { /* ignore */ }
  };

  return { light, medium };
}
