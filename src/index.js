const TelegramBot = require('node-telegram-bot-api');
const util = require('util');
const yobit = require('./exchanges/yobit');

const log = require('./log');
const config = require('./config');

const userData = {};

log.info('starting application')
const bot = new TelegramBot(config.bot.key, { polling: true });

bot.on('text', handleMessage)
bot.on('polling_error', handlePollingError)

async function handleMessage (message) {
	log.debug('handle message', message)

	const buyPattern = /^\/buy\s([A-Z]{2,5})\s([A-Z]{2,5})\s(\d+)(?:\s(\d+))?/
	const buyMatch = buyPattern.exec(message.text)
	if (buyMatch) {
		const [_, ...params] = buyMatch;
		return handleBuyMessage(message, ...params);
	}

	const infoPattern = /^\/info?/
	const infoMatch = infoPattern.exec(message.text)
	if (infoMatch) {
		return handleInfoMessage(message)
	}

}

async function handleBuyMessage (message, buyCurrency, sellCurrency, amount, extra) {
	const pair = `${buyCurrency.toLowerCase()}_${sellCurrency.toLowerCase()}`;
	const ordersResponse = await yobit.sendPublicRequest(`depth/${pair}`);
	const sellOrders = ordersResponse[pair].asks;

	const [actualRate] = sellOrders[0];
	const rangeMultiplier = !extra ? 1 : (1 + extra / 100.0);
	let lowerRate;
	let upperRate;
	if (rangeMultiplier >= 1) {
		lowerRate = actualRate;
		upperRate = actualRate * rangeMultiplier;
	} else {
		upperRate = actualRate;
		lowerRate = actualRate * rangeMultiplier;
	}

	const sellOrdersInRange = sellOrders.filter(o => {
		return o[0] >= lowerRate && o[0] <= upperRate;
	})

	const buys = [];
	let remainingBudget = amount;
	for (let i = 0; i < sellOrdersInRange.length && remainingBudget > 0; ++i) {
		const [rate, sum] = sellOrdersInRange[i]
		const amount = Math.min(remainingBudget / rate, sum)
		const budget = amount * rate
		buys.push({ rate, amount, budget  })
		remainingBudget -= budget
	}

	const buyInfoMessage = `
_About to buy:_
${buys.map((buy) => (
	`${buy.rate.toFixed('8')} | ${buy.amount.toFixed('8')} *${buyCurrency}* | ${buy.budget.toFixed('8')} *${sellCurrency}*\n`
)).join('')}
_Total_ *${(amount - remainingBudget).toFixed('8')} ${sellCurrency}*
	`
	bot.sendMessage(message.chat.id, buyInfoMessage, { parse_mode: 'markdown' })

	//await Promise.map(buys => {
	//})
		/*
	const res = await yobit.sendRequest(
		{
			method: 'Trade',
			pair: `${buyCurrency.toLowerCase()}_${sellCurrency.toLowerCase()}`,
			type: 'buy',
			rate: null, // TODO: get sell orders and then create rate accordingly in the range of extra (percentage)
			amount: null,
		},
		config.exchanges.yobit.key, config.exchanges.yobit.secret
	)
	*/
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
