import { useState, useEffect } from 'react';

export interface DailyWeather {
  date: string;
  maxTemp: number;
  minTemp: number;
  weatherCode: number;
}

// Map WMO weather codes to lucide-react icons and colors
export const getWeatherInfo = (code: number) => {
  // 0: Clear sky
  if (code === 0) return { icon: 'Sun', color: 'text-amber-500', name: 'Senin' };
  // 1, 2, 3: Mainly clear, partly cloudy, and overcast
  if (code === 1 || code === 2) return { icon: 'CloudSun', color: 'text-blue-400', name: 'Parțial noros' };
  if (code === 3) return { icon: 'Cloud', color: 'text-gray-500', name: 'Înnorat' };
  // 45, 48: Fog
  if (code === 45 || code === 48) return { icon: 'CloudFog', color: 'text-gray-400', name: 'Ceață' };
  // 51, 53, 55: Drizzle
  // 61, 63, 65: Rain
  // 80, 81, 82: Rain showers
  if ([51, 53, 55, 61, 63, 65, 80, 81, 82].includes(code)) return { icon: 'CloudRain', color: 'text-blue-500', name: 'Ploaie' };
  // 71, 73, 75: Snow fall
  // 85, 86: Snow showers
  if ([71, 73, 75, 85, 86].includes(code)) return { icon: 'CloudSnow', color: 'text-blue-200', name: 'Ninsoare' };
  // 95, 96, 99: Thunderstorm
  if ([95, 96, 99].includes(code)) return { icon: 'CloudLightning', color: 'text-purple-500', name: 'Furtună' };
  
  return { icon: 'Cloud', color: 'text-gray-400', name: 'Necunoscut' };
};

export const useWeather = (lat: number = 44.3302, lon: number = 23.7949) => {
  const [weather, setWeather] = useState<Record<string, DailyWeather>>({});
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchWeather = async () => {
      try {
        setLoading(true);
        // Fetch 14 days to cover past and future within Kanban range
        const res = await fetch(`https://api.open-meteo.com/v1/forecast?latitude=${lat}&longitude=${lon}&daily=weathercode,temperature_2m_max,temperature_2m_min&timezone=auto&past_days=7&forecast_days=14`);
        const data = await res.json();
        
        if (data.daily) {
          const map: Record<string, DailyWeather> = {};
          data.daily.time.forEach((dateStr: string, index: number) => {
            map[dateStr] = {
              date: dateStr,
              maxTemp: Math.round(data.daily.temperature_2m_max[index]),
              minTemp: Math.round(data.daily.temperature_2m_min[index]),
              weatherCode: data.daily.weathercode[index]
            };
          });
          setWeather(map);
        }
      } catch (err) {
        console.error('Error fetching weather', err);
      } finally {
        setLoading(false);
      }
    };

    fetchWeather();
  }, [lat, lon]);

  return { weather, loading };
};
