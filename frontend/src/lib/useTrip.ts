import { useCallback, useEffect, useState } from 'react';
import { api, errorText } from './api';
import type { Trip } from './types';

/** Load one trip and keep the copy the screens share. */
export function useTrip(tripId: string | undefined) {
  const [trip, setTrip] = useState<Trip | null>(null);
  const [error, setError] = useState('');

  const reload = useCallback(() => {
    if (!tripId) return;
    api
      .get(`/trips/${tripId}`)
      .then(({ data }) => { setTrip(data.trip); setError(''); })
      .catch((err) => setError(errorText(err)));
  }, [tripId]);

  useEffect(reload, [reload]);

  return { trip, setTrip, error, setError, reload };
}
