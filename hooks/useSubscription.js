import { useState, useEffect } from 'react';
import Purchases from 'react-native-purchases';

const ENTITLEMENT_ID = 'Premium';

export function useSubscription() {
  const [isPaid, setIsPaid] = useState(false);
  const [isLoading, setIsLoading] = useState(true);

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

    const listener = Purchases.addCustomerInfoUpdateListener(info => {
      const paid = !!info.entitlements.active[ENTITLEMENT_ID];
      console.log('[useSubscription] customerInfo listener fired — active entitlements:', Object.keys(info.entitlements.active), '| isPaid:', paid);
      if (mounted) setIsPaid(paid);
    });

    return () => {
      mounted = false;
      listener.remove();
    };
  }, []);

  return { isPaid, isLoading };
}
