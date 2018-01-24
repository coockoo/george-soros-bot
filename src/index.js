const TelegramBot = require('node-telegram-bot-api');
const util = require('util');
const yobit = require('./exchanges/yobit');

const log = require('./log');
const config = require('./config');

log.info('starting application')
const bot = new TelegramBot(config.bot.key, { polling: true });

bot.on('text', handleMessage)
bot.on('polling_error', handlePollingError)

async function handleMessage (message) {
	log.debug('handle message', message)

	const buyPattern = /^\/buy\s([A-Z]{2,5})\s([A-Z]{2,5})\s(\d+)(?:\s(\d+))?/
	const buyMatch = buyPattern.exec(message.text)
	if (buyMatch) {
		return handleBuyMessage(message, buyCurrency, sellCurrency, amount, extra)
	}

	const infoPattern = /^\/info?/
	const infoMatch = infoPattern.exec(message.text)
	if (infoMatch) {
		return handleInfoMessage(message)
	}

}

async function handleBuyMessage (message, buyCurrency, sellCurrency, amount, extra) {
	// TODO: Add message localization
	const noticeMessage = util.format('preparing to buy %s for %s %s with extra %s%', buyCurrency, amount, sellCurrency, extra || 0)
	log.debug(noticeMessage)
	bot.sendMessage(message.chat.id, noticeMessage)

	const res = await yobit.sendRequest(
		{
			method: 'Trade',
			pair: `${buyCurrency.toLowerCase()}_${sellCurrency.toLowerCase()}`,
			type: 'buy',
			rate: null, // TODO: get sell orders and then create rate accordingly in the range of extra (percentage)
			amount,
		},
		config.exchanges.yobit.key, config.exchanges.yobit.secret
	)
}

async function handleInfoMessage (message) {
	log.debug('preparing to process info message')
	const res = await yobit.sendRequest(
		{ method: 'getInfo' },
		config.exchanges.yobit.key, config.exchanges.yobit.secret
	)
	console.log(res)
	bot.sendMessage(message.chat.id, `you've got ${res.transaction_count} transactions and ${res.open_orders} open orders`)
}

function handlePollingError (error) {
	log.error('polling error', error)
}

	/*
handleMessage({ text: '/buy USD UAH 100' })
	.then(() => {
		console.log('done')
		process.exit(0)
	})
	*/
