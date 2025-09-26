const API_KEY = process.env.API_KEY;

function auth(req, res, next) {
  const apiKey = req.get('X-API-KEY');
  if (!API_KEY || apiKey === API_KEY) {
    return next();
  }
  return res.status(401).json({ error: 'Unauthorized' });
}

module.exports = { auth };
