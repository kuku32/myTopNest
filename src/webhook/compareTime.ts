import { DateTime } from 'luxon';
 
export function checkIfWithin5MinutesEST(dateString: string): boolean {
  if (!dateString) return false;

  // Parse provider's date as EST
  const providerTime = DateTime.fromFormat(dateString, 'yyyy-MM-dd HH:mm:ss', {
    zone: 'America/New_York',
  });

  // Current EST time
  const nowEST = DateTime.now().setZone('America/New_York');

  // Create ±5 minute window
  const lowerBound = nowEST.minus({ minutes: 7 });
  const upperBound = nowEST.plus({ minutes: 7 });

  // Compare
  return providerTime >= lowerBound && providerTime <= upperBound;
}
