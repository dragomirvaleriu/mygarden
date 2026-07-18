const fs = require('fs');

const content = `import React, { useRef } from 'react';
import { Sun, Cloud, CloudSun, CloudRain, CloudSnow, Wind, Thermometer, Droplets, Gauge, CloudLightning, CloudFog } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { format, parseISO, isToday } from 'date-fns';
import { ro } from 'date-fns/locale';
import { useQuery } from '@tanstack/react-query';

interface Props {
  lat?: number;
  lon?: number;
  address?: string;
  showForecast?: boolean;
  showFullForecast?: boolean;
  compact?: boolean;
  transparent?: boolean;
  onlyForecast?: boolean;
  forecastType?: '5day' | 'hourlySamsung' | 'both';
  samsungMode?: boolean;
  onWeatherData?: (data: any) => void;
}

const getWeatherImage = (code: number) => {
  if (code === 0 || code === 1) return 'https://images.unsplash.com/photo-1601297183314-06f15926c0ac?q=80&w=800&auto=format&fit=crop'; // Clear
  if (code === 2 || code === 3) return 'https://images.unsplash.com/photo-1534088568595-a066f410cbda?q=80&w=800&auto=format&fit=crop'; // Cloudy
  if (code >= 45 && code <= 48) return 'https://images.unsplash.com/photo-1485236715568-ddc5ee6ca227?q=80&w=800&auto=format&fit=crop'; // Fog
  if ((code >= 51 && code <= 67) || (code >= 80 && code <= 82)) return 'https://images.unsplash.com/photo-1515694346937-94d85e41e6f0?q=80&w=800&auto=format&fit=crop'; // Rain
  if ((code >= 71 && code <= 77) || (code >= 85 && code <= 86)) return 'https://images.unsplash.com/photo-1516431883659-655d41c09bf9?q=80&w=800&auto=format&fit=crop'; // Snow
  if (code >= 95) return 'https://images.unsplash.com/photo-1605727216801-e27ce1d0ce3c?q=80&w=800&auto=format&fit=crop'; // Storm
  return 'https://images.unsplash.com/photo-1601297183314-06f15926c0ac?q=80&w=800&auto=format&fit=crop';
};

const getWeatherIcon = (code: number, size = "w-12 h-12") => {
  if (code === 0) return <Sun className={\`\${size} text-yellow-400\`} />;
  if (code === 1 || code === 2) return <CloudSun className={\`\${size} text-blue-400\`} />;
  if (code === 3) return <Cloud className={\`\${size} text-gray-400\`} />;
  if (code >= 45 && code <= 48) return <CloudFog className={\`\${size} text-gray-400\`} />;
  if ((code >= 51 && code <= 67) || (code >= 80 && code <= 82)) return <CloudRain className={\`\${size} text-blue-400\`} />;
  if ((code >= 71 && code <= 77) || (code >= 85 && code <= 86)) return <CloudSnow className={\`\${size} text-white\`} />;
  if (code >= 95) return <CloudLightning className={\`\${size} text-purple-500\`} />;
  return <Sun className={\`\${size} text-yellow-400\`} />;
};

const getWeatherName = (code: number) => {
  if (code === 0) return 'Senin';
  if (code === 1 || code === 2) return 'Parțial noros';
  if (code === 3) return 'Înnorat';
  if (code >= 45 && code <= 48) return 'Ceață';
  if (code >= 51 && code <= 55) return 'Burniță';
  if (code >= 61 && code <= 67) return 'Ploaie';
  if (code >= 71 && code <= 77) return 'Ninsoare';
  if (code >= 80 && code <= 82) return 'Averse de ploaie';
  if (code >= 85 && code <= 86) return 'Averse de ninsoare';
  if (code >= 95) return 'Furtună';
  return 'Variabil';
};

const Weather: React.FC<Props> = ({ lat, lon, address, showForecast = false, showFullForecast = false, compact = false, transparent = false, onlyForecast = false, forecastType = 'both', samsungMode = false, onWeatherData }) => {
  const { t, i18n } = useTranslation();
  const containerRef = useRef<HTMLDivElement>(null);

  const { data: weatherData, isLoading: loading, error: queryError } = useQuery({
    queryKey: ['weather', lat, lon, address],
    queryFn: async () => {
      let finalLat = lat;
      let finalLon = lon;

      if (!finalLat || !finalLon) {
        const query = address || 'Craiova, Romania';
        if (query.toLowerCase().includes('craiova') || query.toLowerCase().includes('malu mare')) {
          finalLat = 44.3302;
          finalLon = 23.7949;
        } else {
          // Geocode fallback
          const geoRes = await fetch(\`https://geocoding-api.open-meteo.com/v1/search?name=\${encodeURIComponent(query)}&count=1&language=en&format=json\`);
          const geoData = await geoRes.json();
          if (geoData.results && geoData.results.length > 0) {
            finalLat = geoData.results[0].latitude;
            finalLon = geoData.results[0].longitude;
          } else {
            finalLat = 44.3302; // Default Craiova
            finalLon = 23.7949;
          }
        }
      }

      const res = await fetch(\`https://api.open-meteo.com/v1/forecast?latitude=\${finalLat}&longitude=\${finalLon}&current=temperature_2m,relative_humidity_2m,apparent_temperature,precipitation,weather_code,cloud_cover,surface_pressure,wind_speed_10m,wind_direction_10m,wind_gusts_10m&hourly=temperature_2m,relative_humidity_2m,precipitation_probability,weather_code,wind_speed_10m&daily=weather_code,temperature_2m_max,temperature_2m_min,precipitation_probability_max,uv_index_max&timezone=auto&forecast_days=7\`);
      
      if (!res.ok) throw new Error(\`Open-Meteo Error: \${res.status}\`);
      return res.json();
    }
  });

  React.useEffect(() => {
    if (onWeatherData && weatherData?.current) {
      onWeatherData({
        current: { temp: Math.round(weatherData.current.temperature_2m) },
        forecast: []
      });
    }
  }, [weatherData, onWeatherData]);

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center py-8 opacity-50 animate-pulse">
        <Sun className="w-8 h-8 text-emerald-500 mb-2" />
        <p className="text-[11px] font-black uppercase tracking-widest">{t('Loading Weather...')}</p>
      </div>
    );
  }

  if (queryError || !weatherData || !weatherData.current) {
    return (
      <div className="flex flex-col items-center justify-center py-8 bg-bg-main/50 rounded-xl border border-dashed border-border-color">
        <Cloud className="w-8 h-8 text-text-secondary/30 mb-2" />
        <p className="text-[11px] font-black uppercase tracking-widest text-text-secondary">{t('Meteo Indisponibil')}</p>
      </div>
    );
  }

  const current = weatherData.current;
  const daily = weatherData.daily;
  const hourly = weatherData.hourly;

  const currentInfo = {
    temp: Math.round(current.temperature_2m),
    feelsLike: Math.round(current.apparent_temperature),
    code: current.weather_code,
    description: getWeatherName(current.weather_code),
    humidity: current.relative_humidity_2m,
    windSpeed: (current.wind_speed_10m * 1000 / 3600).toFixed(1), // km/h to m/s
    windGusts: (current.wind_gusts_10m * 1000 / 3600).toFixed(1),
    pressure: Math.round(current.surface_pressure),
    precipitation: current.precipitation,
    uvIndex: daily.uv_index_max?.[0] ? Math.round(daily.uv_index_max[0]) : 0
  };

  const bgImage = getWeatherImage(currentInfo.code);

  const forecast7Days = daily.time.map((tStr: string, i: number) => ({
    date: tStr,
    tempMax: Math.round(daily.temperature_2m_max[i]),
    tempMin: Math.round(daily.temperature_2m_min[i]),
    code: daily.weather_code[i],
    pop: daily.precipitation_probability_max[i]
  }));

  // Find the next 24 hours in the hourly array
  const now = new Date();
  let currentHourIdx = hourly.time.findIndex((tStr: string) => new Date(tStr) >= now);
  if (currentHourIdx === -1) currentHourIdx = 0;
  
  const hourly24 = hourly.time.slice(currentHourIdx, currentHourIdx + 24).map((tStr: string, idx: number) => {
    const realIdx = currentHourIdx + idx;
    return {
      time: format(new Date(tStr), 'HH:mm'),
      temp: Math.round(hourly.temperature_2m[realIdx]),
      code: hourly.weather_code[realIdx],
      pop: hourly.precipitation_probability[realIdx],
      wind: hourly.wind_speed_10m[realIdx]
    };
  });

  if (compact) {
    return (
      <div className="flex items-center gap-1 relative z-10">
        <div className="group/weather relative flex-shrink-0 cursor-help">
          {getWeatherIcon(currentInfo.code, "w-4 h-4")}
          
          <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 w-48 bg-bg-card border border-border-color rounded-xl shadow-2xl p-3 opacity-0 invisible group-hover/weather:opacity-100 group-hover/weather:visible transition-all z-[100] pointer-events-none">
            <p className="text-xs font-black uppercase tracking-widest text-accent-color mb-2">{currentInfo.description}</p>
            <div className="space-y-1.5">
              <div className="flex items-center justify-between text-[11px] font-bold">
                <span className="flex items-center gap-1 text-text-secondary"><Thermometer size={10} /> Temp</span>
                <span className="text-main">{currentInfo.temp}°C</span>
              </div>
              <div className="flex items-center justify-between text-[11px] font-bold">
                <span className="flex items-center gap-1 text-text-secondary"><Droplets size={10} /> Umiditate</span>
                <span className="text-main">{currentInfo.humidity}%</span>
              </div>
              <div className="flex items-center justify-between text-[11px] font-bold">
                <span className="flex items-center gap-1 text-text-secondary"><Wind size={10} /> Vânt</span>
                <span className="text-main">{currentInfo.windSpeed} m/s</span>
              </div>
            </div>
          </div>
        </div>
        <span className="text-[11px] font-bold text-main dark:text-white">{currentInfo.temp}°C</span>
      </div>
    );
  }

  // ====== SAMSUNG PREMIUM MODE ======
  if (samsungMode) {
    return (
      <div className="w-full h-full flex flex-col space-y-2 relative overflow-hidden rounded-2xl bg-bg-card border border-border-color/50">
        <img src={bgImage} className="absolute inset-0 w-full h-full object-cover opacity-20 mix-blend-overlay dark:opacity-30 pointer-events-none transition-all duration-1000" alt="weather background" />
        <div className="absolute inset-0 bg-gradient-to-b from-bg-card/40 via-bg-card/80 to-bg-card z-0"></div>

        <div className="relative z-10 flex flex-col space-y-2 flex-1 p-1">
          {/* CURRENT WEATHER HUGE */}
          <div className="flex flex-col items-center justify-center py-6 mt-2">
             <div className="drop-shadow-lg mb-2">
               {getWeatherIcon(currentInfo.code, "w-16 h-16")}
             </div>
             <h2 className="text-[5rem] leading-[0.8] font-black tracking-tighter text-main dark:text-white drop-shadow-md">
               {currentInfo.temp}°
             </h2>
             <p className="text-[14px] font-black text-main mt-2 capitalize tracking-tight flex items-center gap-1.5 drop-shadow-md">
               {currentInfo.description} • Resimțit {currentInfo.feelsLike}°
             </p>
             <div className="grid grid-cols-2 xs:grid-cols-4 gap-2 mt-4 px-4 w-full max-w-md">
               <div className="flex flex-col items-center bg-black/5 dark:bg-white/5 rounded-xl p-2 backdrop-blur-sm border border-white/10 shadow-sm">
                 <Droplets size={14} className="text-blue-500 mb-1" />
                 <span className="text-[11px] font-black text-main">{currentInfo.humidity}%</span>
                 <span className="text-[8px] font-bold text-text-secondary uppercase">Umiditate</span>
               </div>
               <div className="flex flex-col items-center bg-black/5 dark:bg-white/5 rounded-xl p-2 backdrop-blur-sm border border-white/10 shadow-sm">
                 <Wind size={14} className="text-gray-400 mb-1" />
                 <span className="text-[11px] font-black text-main">{currentInfo.windSpeed} m/s</span>
                 <span className="text-[8px] font-bold text-text-secondary uppercase">Vânt</span>
               </div>
               <div className="flex flex-col items-center bg-black/5 dark:bg-white/5 rounded-xl p-2 backdrop-blur-sm border border-white/10 shadow-sm">
                 <Gauge size={14} className="text-emerald-500 mb-1" />
                 <span className="text-[11px] font-black text-main">{currentInfo.pressure}</span>
                 <span className="text-[8px] font-bold text-text-secondary uppercase">hPa</span>
               </div>
               <div className="flex flex-col items-center bg-black/5 dark:bg-white/5 rounded-xl p-2 backdrop-blur-sm border border-white/10 shadow-sm">
                 <Sun size={14} className="text-amber-500 mb-1" />
                 <span className="text-[11px] font-black text-main">{currentInfo.uvIndex}</span>
                 <span className="text-[8px] font-bold text-text-secondary uppercase">Index UV</span>
               </div>
             </div>
          </div>

          {/* HOURLY GRAPH TRANSLUCENT CARD */}
          {hourly24.length > 0 && (
            <div className="bg-white/40 dark:bg-black/40 rounded-2xl p-4 border border-white/20 dark:border-white/10 backdrop-blur-xl mx-3 shadow-lg">
              <p className="text-[9px] font-black uppercase tracking-widest text-main mb-3 flex items-center gap-1.5">
                <Sun size={10} className="text-amber-500" /> Prognoză 24 Ore
              </p>
              <div className="w-full overflow-x-auto custom-scrollbar pb-2">
                <div className="relative flex justify-start gap-5 items-start min-w-max px-2">
                  <svg className="absolute top-[34px] left-[20px] right-[20px] w-[calc(100%-40px)] h-8 z-0 overflow-visible pointer-events-none" preserveAspectRatio="none">
                     <polyline
                       points={hourly24.map((h: any, i: number) => {
                         const maxT = Math.max(...hourly24.map((hx: any) => hx.temp));
                         const minT = Math.min(...hourly24.map((hx: any) => hx.temp));
                         const range = maxT - minT || 1;
                         const y = 30 - ((h.temp - minT) / range) * 25;
                         return \`\${i * 60},\${y}\`;
                       }).join(' ')}
                       fill="none"
                       stroke="#fbbf24"
                       strokeWidth="2.5"
                       strokeLinecap="round"
                       strokeLinejoin="round"
                     />
                     {hourly24.map((h: any, i: number) => {
                         const maxT = Math.max(...hourly24.map((hx: any) => hx.temp));
                         const minT = Math.min(...hourly24.map((hx: any) => hx.temp));
                         const range = maxT - minT || 1;
                         const y = 30 - ((h.temp - minT) / range) * 25;
                         return (
                           <circle key={i} cx={i * 60} cy={y} r="3.5" fill="var(--bg-card, white)" stroke="#fbbf24" strokeWidth="2.5" />
                         );
                     })}
                  </svg>

                  {hourly24.map((hour: any, idx: number) => (
                    <div key={idx} className="relative z-10 flex flex-col items-center group w-[40px] shrink-0 pt-1">
                      <span className="text-[10px] font-bold text-main mb-1.5">{hour.time}</span>
                      <div className="flex items-center justify-center h-8 w-8 mb-[32px] drop-shadow-sm">
                        {getWeatherIcon(hour.code, "w-6 h-6")}
                      </div>
                      <div className="flex flex-col items-center mt-3">
                        <span className="text-[13px] font-black text-main drop-shadow-sm">{hour.temp}°</span>
                        {hour.pop > 0 && (
                          <div className="flex items-center gap-0.5 mt-1">
                            <Droplets size={8} className="text-blue-500" />
                            <span className="text-[9px] font-bold text-blue-600 dark:text-blue-400">{hour.pop}%</span>
                          </div>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}

          {/* 7-DAY VERTICAL TRANSLUCENT CARD */}
          {forecast7Days.length > 0 && (
            <div className="bg-white/40 dark:bg-black/40 rounded-2xl p-4 border border-white/20 dark:border-white/10 backdrop-blur-xl flex-1 mx-3 mb-3 shadow-lg">
              <p className="text-[9px] font-black uppercase tracking-widest text-main mb-2 flex items-center gap-1.5">
                <CloudRain size={10} className="text-blue-500" /> Prognoză 7 Zile
              </p>
              <div className="flex flex-col gap-1">
                {forecast7Days.map((day: any, idx: number) => (
                  <div key={idx} className="flex items-center justify-between py-1.5 border-b border-black/5 dark:border-white/5 last:border-0">
                    <span className={\`text-[11px] font-black uppercase w-12 \${idx === 0 ? 'text-accent-color' : 'text-main'}\`}>
                      {idx === 0 ? 'Azi' : format(parseISO(day.date), 'EEE', { locale: ro })}
                    </span>
                    <div className="flex items-center justify-center flex-1">
                       <div className="flex items-center gap-2 w-20">
                          {getWeatherIcon(day.code, "w-5 h-5")}
                          {day.pop > 0 ? (
                            <span className="text-[9px] font-bold text-blue-600 dark:text-blue-400 flex items-center gap-0.5">
                              {day.pop}%
                            </span>
                          ) : <span className="w-6"></span>}
                       </div>
                    </div>
                    <div className="flex items-center justify-end w-20 gap-2">
                       <span className="text-[11px] font-bold text-text-secondary">{day.tempMin}°</span>
                       <div className="w-8 h-1 rounded-full bg-gradient-to-r from-blue-400 to-amber-500 opacity-50"></div>
                       <span className="text-[13px] font-black text-main">{day.tempMax}°</span>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-2">
       {/* Simplu Weather Box etc */}
       <div className="stihl-card p-4">
          <p>Meteo Normal - Te rog folosește Samsung Mode pentru UI-ul complet.</p>
       </div>
    </div>
  );
};

export default Weather;
`

fs.writeFileSync('components/Weather.tsx', content);
console.log('Weather.tsx written successfully');
