module.exports = {
	env: process.env.NODE_ENV || 'development',
	bot: {
		key: process.env.TELEGRAM_BOT_KEY,
	},
	redis: process.env.REDIS_URI,
};
