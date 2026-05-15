// React hook that reads and tracks the user's RevenueCat subscription status.
// Fetches the initial customer info on mount and subscribes to real-time entitlement
// changes so isPaid stays accurate after purchases, restores, or cancellations.
import { useState, useEffect } from 'react';
import Purchases from 'react-native-purchases';

const ENTITLEMENT_ID = 'Premium';

// Returns { isPaid, isLoading }. isPaid is true when the 'Premium' entitlement is active.
export function useSubscription() {
  const [isPaid, setIsPaid] = useState(false);
  const [isLoading, setIsLoading] = useState(true);

  // Fetch initial subscription state and attach a real-time listener for entitlement changes.
  useEffect(() => {
    let mounted = true;

    Purchases.getCustomerInfo()
      .then(info => {
        const paid = !!info.entitlements.active[ENTITLEMENT_ID];
        console.log('[useSubscription] initial getCustomerInfo — active entitlements:', Object.keys(info.entitlements.active), '| isPaid:', paid);
        if (mounted) setIsPaid(paid);
      })
      .catch((err) => console.error('[useSubscription] getCustomerInfo error:', err))
      .finally(() => {
        if (mounted) setIsLoading(false);
      });

    // Keep isPaid in sync after any in-app purchase, restore, or subscription change.
    const listener = Purchases.addCustomerInfoUpdateListener(info => {
      const paid = !!info.entitlements.active[ENTITLEMENT_ID];
      console.log('[useSubscription] customerInfo listener fired — active entitlements:', Object.keys(info.entitlements.active), '| isPaid:', paid);
      if (mounted) setIsPaid(paid);
    });

    // Remove the listener on unmount to prevent state updates on a dead component.
    return () => {
      mounted = false;
      if (listener && listener.remove) {
        listener.remove();
      }
    };
  }, []);

  return { isPaid, isLoading };
}
