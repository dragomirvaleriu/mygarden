export default async function handler(req: any, res: any) {
  const { url } = req.query;
  if (!url || typeof url !== "string") {
    return res.status(400).json({ error: "Missing URL parameter" });
  }

  try {
    const response = await fetch(url, {
      method: 'GET',
      redirect: 'follow',
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36'
      }
    });
    
    res.status(200).json({ resolvedUrl: response.url });
  } catch (err: any) {
    console.error("Error resolving maps link:", err);
    res.status(500).json({ error: "Failed to resolve link" });
  }
}
