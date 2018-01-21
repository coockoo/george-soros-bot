const TelegramBot = require('node-telegram-bot-api');
const util = require('util')
const log = require('./log');
const config = require('./config');

log.info('starting application')
const bot = new TelegramBot(config.bot.key, { polling: true });

bot.on('text', handleMessage)
bot.on('polling_error', handlePollingError)

function handleMessage (message) {
	log.debug('handle message', message)
	const buyPattern = /^\/buy\s([A-Z]{2,4})\s([A-Z]{2,4})\s(\d+)(?:\s(\d+))?/
	const match = buyPattern.exec(message.text)
	if (!match) {
		return
	}
	const [fullMath, buyCurrency, sellCurrency, amount, extra] = match
	// TODO: Add message localization
	const noticeMessage = util.format('preparing to buy %s for %s %s with extra %s%', buyCurrency, amount, sellCurrency, extra || 0)
	log.debug(noticeMessage)
	bot.sendMessage(message.chat.id, noticeMessage)
	// TODO: Add actual exchange order placed send
}

function handlePollingError (error) {
	log.error('polling error', error)
}
