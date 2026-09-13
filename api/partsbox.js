export default async function handler(req, res) {
  const op = req.query?.op;
  if (!op) {
    res.status(400).json({ error: 'Missing op param' });
    return;
  }

  try {
    const r = await fetch(`https://api.partsbox.com/api/1/${op}`, {
      method: 'POST',
      headers: {
        'Authorization': `APIKey ${process.env.PARTSBOX_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(req.body || {}),
    });
    const data = await r.json();
    res.status(r.status).json(data);
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
}
