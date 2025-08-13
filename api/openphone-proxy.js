// Serverless proxy: accepts GHL key/value and forwards JSON to OpenPhone
const getBody = (req) =>
  new Promise((resolve) => {
    let data = '';
    req.on('data', (c) => (data += c));
    req.on('end', () => {
      const ct = (req.headers['content-type'] || '').toLowerCase();
      try {
        if (ct.includes('application/json')) return resolve(JSON.parse(data || '{}'));
        // x-www-form-urlencoded
        const params = new URLSearchParams(data || '');
        const obj = Object.fromEntries(params.entries());
        return resolve(obj);
      } catch {
        resolve({});
      }
    });
  });

module.exports = async (req, res) => {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Use POST' });

  try {
    const body = await getBody(req);
    const from = body.from;
    const content = body.content;
    // GHL may send "to" as a single string—wrap as array for OpenPhone
    const to = Array.isArray(body.to) ? body.to : body.to ? [body.to] : [];

    if (!from || !to.length || !content) {
      return res.status(400).json({ error: 'Missing from/to/content' });
    }

    const r = await fetch('https://api.openphone.com/v1/messages', {
      method: 'POST',
      headers: {
        Authorization: process.env.OPENPHONE_API_KEY, // no "Bearer"
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ from, to, content }),
    });

    const json = await r.json();
    return res.status(r.status).json(json);
  } catch (e) {
    return res.status(500).json({ error: e.message || 'Proxy error' });
  }
};
