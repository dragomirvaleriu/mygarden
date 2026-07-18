// Utility logic to sync weather with irrigation

interface WeatherForecast {
  precipitationProbability: number; // 0-100
  precipitationAmount: number; // mm
}

interface SyncResult {
  shouldSuspend: boolean;
  reason: string;
}

export function evaluateSmartIrrigation(forecast: WeatherForecast): SyncResult {
  const PROBABILITY_THRESHOLD = 60; // %
  const AMOUNT_THRESHOLD = 5; // mm

  if (forecast.precipitationProbability > PROBABILITY_THRESHOLD && forecast.precipitationAmount > AMOUNT_THRESHOLD) {
    return {
      shouldSuspend: true,
      reason: `Prognoză meteo: ${forecast.precipitationProbability}% probabilitate de precipitații (${forecast.precipitationAmount}mm). Suspendare recomandată pentru a economisi apă și a preveni bolile.`
    };
  }

  return {
    shouldSuspend: false,
    reason: `Prognoză favorabilă udării. Precipitații estimate: ${forecast.precipitationAmount}mm.`
  };
}
