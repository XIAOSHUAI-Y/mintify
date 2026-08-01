export type UpdateCheckResult = 'update-available' | 'up-to-date';

export interface UpdatableServiceWorkerRegistration {
  waiting: ServiceWorker | null;
  installing: ServiceWorker | null;
  update: () => Promise<unknown>;
  addEventListener: (type: 'updatefound', listener: () => void) => void;
  removeEventListener: (type: 'updatefound', listener: () => void) => void;
}

export async function checkServiceWorkerUpdate(
  registration: UpdatableServiceWorkerRegistration,
): Promise<UpdateCheckResult> {
  if (registration.waiting || registration.installing) return 'update-available';

  let updateFound = false;
  const onUpdateFound = () => {
    updateFound = true;
  };

  registration.addEventListener('updatefound', onUpdateFound);
  try {
    await registration.update();
    return updateFound || registration.waiting || registration.installing
      ? 'update-available'
      : 'up-to-date';
  } finally {
    registration.removeEventListener('updatefound', onUpdateFound);
  }
}
