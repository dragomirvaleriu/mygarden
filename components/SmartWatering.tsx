import React, { useState } from 'react';
import { motion } from 'framer-motion';
import { Droplets, Sun, CloudRain, Wind, AlertTriangle, CheckCircle2, ThermometerSun, Clock, Flame } from 'lucide-react';

interface WeatherDay {
  day: string;
  rain: number;
  wind: number;
  tempMax: number;
  tempMin: number;
}

interface SprayCondition {
  ok: boolean;
  reasons: string[];
}

const getSprayCondition = (f: WeatherDay): SprayCondition => {
  const reasons: string[] = [];
  if (f.rain > 1)    reasons.push(`Ploaie ${f.rain}mm`);
  if (f.wind > 15)   reasons.push(`Vânt ${f.wind}km/h`);
  if (f.tempMax > 28) reasons.push(`Temp. max ${f.tempMax}°C`);
  return { ok: reasons.length === 0, reasons };
};

const SmartWatering: React.FC = () => {
  // Balanță Hidrică simulată
  const [hydroData] = useState({ rainWeek: 8, etWeek: 35 });
  const waterNeeded = Math.max(0, hydroData.etWeek - hydroData.rainWeek);
  const waterPerSession = (waterNeeded / 2).toFixed(1); // 2 ședințe recomandate

  // Forecast simulat
  const [forecast] = useState<WeatherDay[]>([
    { day: 'Azi',       rain: 0,   wind: 8,  tempMax: 26, tempMin: 14 },
    { day: 'Mâine',     rain: 2.5, wind: 12, tempMax: 24, tempMin: 15 },
    { day: 'Poimâine',  rain: 0,   wind: 18, tempMax: 28, tempMin: 16 },
    { day: 'Joi',       rain: 0,   wind: 9,  tempMax: 31, tempMin: 17 },
  ]);

  const bestDay = forecast.find(f => getSprayCondition(f).ok);

  return (
    <div className="bg-white/80 backdrop-blur-xl rounded-[2rem] p-6 shadow-sm border border-gray-100 max-w-3xl mx-auto relative overflow-hidden">

      {/* Header */}
      <div className="flex items-center gap-3 mb-8 border-b border-gray-100 pb-5">
        <div className="w-12 h-12 rounded-xl bg-cyan-50 text-cyan-600 flex items-center justify-center border border-cyan-100 shadow-inner">
          <Droplets className="w-6 h-6" />
        </div>
        <div>
          <h2 className="font-bold text-gray-900 text-xl leading-tight">Irigare & Meteo Tratamente</h2>
          <p className="text-xs text-gray-500 font-bold uppercase tracking-widest mt-0.5">
            Balanță Hidrică și Ferestre de Spray
          </p>
        </div>
      </div>

      <div className="space-y-10">

        {/* ═══ SECȚIUNEA 1: BALANȚĂ HIDRICĂ ════════════════════════════════ */}
        <section>
          <h3 className="text-sm font-bold text-gray-800 mb-4 flex items-center gap-2">
            <span className="w-2 h-2 rounded-full bg-cyan-500" /> Balanță Hidrică (ET₀ − Precipitații)
          </h3>

          {/* Stats Row */}
          <div className="grid grid-cols-2 gap-4 mb-4">
            <div className="bg-blue-50/50 border border-blue-100 rounded-2xl p-4 flex flex-col justify-center shadow-sm">
              <div className="flex items-center gap-2 mb-1 text-blue-600">
                <CloudRain className="w-4 h-4" />
                <span className="text-[10px] font-bold uppercase tracking-wider">Precipitații (7 zile)</span>
              </div>
              <p className="text-3xl font-black text-gray-900">{hydroData.rainWeek} <span className="text-sm font-bold text-gray-500">mm</span></p>
            </div>
            <div className="bg-amber-50/50 border border-amber-100 rounded-2xl p-4 flex flex-col justify-center shadow-sm">
              <div className="flex items-center gap-2 mb-1 text-amber-600">
                <Sun className="w-4 h-4" />
                <span className="text-[10px] font-bold uppercase tracking-wider">Evapotranspirație (ET₀)</span>
              </div>
              <p className="text-3xl font-black text-gray-900">{hydroData.etWeek} <span className="text-sm font-bold text-gray-500">mm</span></p>
            </div>
          </div>

          {/* HERO ACTION BANNER */}
          <motion.div
            initial={{ opacity: 0, scale: 0.97 }}
            animate={{ opacity: 1, scale: 1 }}
            className="bg-gradient-to-br from-cyan-600 to-cyan-700 text-white p-6 rounded-2xl shadow-lg shadow-cyan-600/25 relative overflow-hidden"
          >
            <div className="absolute -right-10 -top-10 w-36 h-36 bg-white/10 rounded-full blur-2xl" />
            <div className="relative z-10">
              <p className="text-cyan-100 text-[10px] font-black uppercase tracking-widest mb-2">▸ Acțiune Recomandată</p>
              <div className="flex items-end gap-4 mb-3">
                <div>
                  <h4 className="text-4xl font-black tracking-tight">{waterNeeded} <span className="text-xl font-bold text-cyan-200">mm</span></h4>
                  <p className="text-cyan-100 text-sm mt-0.5">deficit hidric de compensat</p>
                </div>
                <div className="ml-auto text-right">
                  <p className="text-[10px] text-cyan-200 font-bold uppercase">Per ședință</p>
                  <p className="text-2xl font-black text-white">{waterPerSession} mm</p>
                  <p className="text-[10px] text-cyan-200 font-bold">× 2 ședințe</p>
                </div>
              </div>
              <div className="h-px bg-white/20 mb-3" />
              <p className="text-sm text-cyan-50 leading-relaxed">
                Gazonul a evapotranspirat <strong className="text-white">{hydroData.etWeek} mm</strong>, iar ploaia a acoperit doar <strong className="text-white">{hydroData.rainWeek} mm</strong>.
              </p>
            </div>
          </motion.div>

          {/* Best Window Tip */}
          <div className="mt-3 bg-emerald-50 border border-emerald-100 rounded-xl px-4 py-3 flex items-start gap-3">
            <Clock className="w-4 h-4 text-emerald-600 shrink-0 mt-0.5" />
            <div>
              <p className="text-xs font-black text-emerald-700">Cel mai bun interval: 04:00 – 08:00</p>
              <p className="text-[11px] text-emerald-600 font-medium mt-0.5">Minimizezi evaporarea și riscul de boli fungice (Brown Patch)</p>
            </div>
          </div>
        </section>

        {/* ═══ SECȚIUNEA 2: SPRAY WINDOWS ═══════════════════════════════════ */}
        <section>
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-sm font-bold text-gray-800 flex items-center gap-2">
              <span className="w-2 h-2 rounded-full bg-purple-500" /> Ferestre de Tratament (Spray Windows)
            </h3>
            {bestDay && (
              <span className="text-[10px] font-black text-emerald-600 bg-emerald-50 px-2.5 py-1 rounded-lg border border-emerald-100">
                ✓ Optim: {bestDay.day}
              </span>
            )}
          </div>

          {/* Factori limitative legend */}
          <div className="flex flex-wrap gap-2 mb-4">
            {[
              { icon: <CloudRain className="w-3 h-3" />, label: 'Ploaie > 1mm', color: 'text-blue-600 bg-blue-50 border-blue-100' },
              { icon: <Wind className="w-3 h-3" />, label: 'Vânt > 15km/h', color: 'text-gray-600 bg-gray-50 border-gray-100' },
              { icon: <Flame className="w-3 h-3" />, label: 'Temp > 28°C', color: 'text-orange-600 bg-orange-50 border-orange-100' },
            ].map(({ icon, label, color }) => (
              <span key={label} className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg border text-[10px] font-bold ${color}`}>
                {icon} {label} = Interzis
              </span>
            ))}
          </div>

          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            {forecast.map((f, i) => {
              const cond = getSprayCondition(f);
              const isGood = cond.ok;

              return (
                <motion.div
                  key={f.day}
                  initial={{ opacity: 0, y: 15 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: i * 0.1 }}
                  className={`rounded-2xl p-4 border flex flex-col justify-between transition hover:shadow-md ${isGood ? 'bg-white border-gray-100 shadow-sm' : 'bg-red-50/40 border-red-100'}`}
                >
                  <div>
                    <h4 className={`font-black text-base mb-3 ${isGood ? 'text-gray-900' : 'text-red-700'}`}>{f.day}</h4>

                    {/* Temp Range */}
                    <div className="flex items-center justify-between text-sm font-medium text-gray-600 mb-1.5">
                      <span className="flex items-center gap-1"><ThermometerSun className={`w-3.5 h-3.5 ${f.tempMax > 28 ? 'text-orange-500' : 'text-gray-400'}`} /></span>
                      <span className={`font-black text-sm ${f.tempMax > 28 ? 'text-orange-500' : 'text-gray-700'}`}>
                        {f.tempMin}° / {f.tempMax}°
                        {f.tempMax > 28 && <span className="text-orange-400 text-[10px] font-black ml-1">🔥</span>}
                      </span>
                    </div>

                    {/* Rain */}
                    <div className="flex items-center justify-between text-sm font-medium text-gray-600 mb-1.5">
                      <span className="flex items-center gap-1"><CloudRain className="w-3.5 h-3.5 text-blue-400" /></span>
                      <span className={f.rain > 1 ? 'text-blue-600 font-black' : 'text-gray-500 font-semibold'}>{f.rain} mm</span>
                    </div>

                    {/* Wind */}
                    <div className="flex items-center justify-between text-sm font-medium text-gray-600 mb-3">
                      <span className="flex items-center gap-1"><Wind className="w-3.5 h-3.5 text-gray-400" /></span>
                      <span className={f.wind > 15 ? 'text-amber-600 font-black' : 'text-gray-500 font-semibold'}>{f.wind} km/h</span>
                    </div>
                  </div>

                  {/* Status Badge */}
                  <div className={`rounded-xl p-2.5 border flex items-center justify-center gap-1.5 ${isGood ? 'bg-emerald-50 border-emerald-200 text-emerald-700' : 'bg-red-100/60 border-red-200 text-red-700'}`}>
                    {isGood
                      ? <><CheckCircle2 className="w-4 h-4 text-emerald-500" /><span className="text-[10px] font-black uppercase tracking-wide">Optim</span></>
                      : <><AlertTriangle className="w-4 h-4 text-red-500" /><span className="text-[10px] font-black uppercase tracking-wide">Blocat</span></>
                    }
                  </div>
                  {!isGood && (
                    <p className="text-[9px] text-red-500 font-bold text-center mt-1.5">{cond.reasons.join(' · ')}</p>
                  )}
                </motion.div>
              );
            })}
          </div>
        </section>

      </div>
    </div>
  );
};

export default SmartWatering;
