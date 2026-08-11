// Vercel's edge network adds this header to every incoming request — no API
// key or external geo-IP service needed. See src/i18n.ts for how it's used
// (first-time visitors only; RO in Romania, EN elsewhere).
export default function handler(req: any, res: any) {
  const country = (req.headers['x-vercel-ip-country'] as string) || null;
  res.status(200).json({ country });
}
