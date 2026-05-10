import * as Notifications from 'expo-notifications';

Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowAlert: true,
    shouldPlaySound: true,
    shouldSetBadge: false,
  }),
});

export async function requestNotificationPermissions() {
  const { status: existing } = await Notifications.getPermissionsAsync();
  if (existing === 'granted') return true;
  const { status } = await Notifications.requestPermissionsAsync();
  return status === 'granted';
}

export async function scheduleLentNotifications(itemName, friendName, returnDate) {
  const ids = { before: null, dayOf: null };
  const now = new Date();

  const dayBefore = new Date(returnDate);
  dayBefore.setDate(dayBefore.getDate() - 1);
  dayBefore.setHours(9, 0, 0, 0);

  if (dayBefore > now) {
    ids.before = await Notifications.scheduleNotificationAsync({
      content: {
        title: 'Heads up!',
        body: `${itemName} is due back from ${friendName} tomorrow`,
      },
      trigger: { type: 'date', date: dayBefore },
    });
  }

  const dayOf = new Date(returnDate);
  dayOf.setHours(9, 0, 0, 0);

  if (dayOf > now) {
    ids.dayOf = await Notifications.scheduleNotificationAsync({
      content: {
        title: 'Return date is today!',
        body: `${itemName} should be returned by ${friendName} today`,
      },
      trigger: { type: 'date', date: dayOf },
    });
  }

  return ids;
}

export async function cancelLentNotifications(idBefore, idDayOf) {
  if (idBefore) await Notifications.cancelScheduledNotificationAsync(idBefore);
  if (idDayOf) await Notifications.cancelScheduledNotificationAsync(idDayOf);
}
