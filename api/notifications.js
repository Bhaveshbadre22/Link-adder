const db = require('../db');
const { getUserFromRequest } = require('./_auth');

module.exports = async (req, res) => {
	const method = req.method || 'GET';
	if (method !== 'GET') {
		res.statusCode = 405;
		res.setHeader('Content-Type', 'application/json');
		return res.end(JSON.stringify({ error: 'method not allowed' }));
	}
	const user = getUserFromRequest(req, res);
	if (!user) return;
	try {
		const rows = await db.all(
			'SELECT id, type, actor, message, link_id, folder_id, created_at FROM notifications ORDER BY created_at DESC LIMIT 50'
		);
		res.statusCode = 200;
		res.setHeader('Content-Type', 'application/json');
		res.end(JSON.stringify(rows));
	} catch (err) {
		res.statusCode = 500;
		res.setHeader('Content-Type', 'application/json');
		res.end(JSON.stringify({ error: err.message }));
	}
};
