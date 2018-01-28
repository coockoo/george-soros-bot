const TelegramBot = require('node-telegram-bot-api');
const fs = require('fs');
const path = require('path');
const yobit = require('./exchanges/yobit');

const log = require('./log');
const config = require('./config');
const { env } = config;
const redis = require('./redis');

const startMessage = fs.readFileSync(path.join(__dirname, 'start-message.md'), 'utf8')
const helpMessage = fs.readFileSync(path.join(__dirname, 'help-message.md'), 'utf8')

log.info('starting application', { env })
const bot = new TelegramBot(config.bot.key, { polling: true });

bot.on('text', handleMessage)
bot.on('polling_error', handlePollingError)

async function handleMessage (message) {
	log.debug('handle message', message)

	const startPattern = /^\/start/;
	const startMatch = startPattern.exec(message.text)
	if (startMatch) {
		const [_, ...params] = startMatch;
		return handleStartMessage(message, params);
	}

	const helpPattern = /^\/help/;
	const helpMatch = helpPattern.exec(message.text)
	if (helpMatch) {
		const [_, ...params] = helpMatch;
		return handleHelpMessage(message, ...params);
	}

	const buyPattern = /^\/buy\s([A-Z]{2,5})\s([A-Z]{2,5})\s([\d\.]+)(?:\s([\d\.]+))?/
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

	const setPattern = /^\/set\s([a-zA-Z_]+)\s(.+)?/;
	const setMatch = setPattern.exec(message.text);
	if (setMatch) {
		const [_, ...params] = setMatch;
		return handleSetMessage(message, ...params);
	}
}

async function handleStartMessage (message) {
	bot.sendMessage(message.chat.id, startMessage, { parse_mode: 'markdown' })
}

async function handleHelpMessage (message) {
	bot.sendMessage(message.chat.id, helpMessage, { parse_mode: 'markdown' })
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
About to buy:
${buys.map((buy) => (
	`${buy.rate.toFixed('8')} | ${buy.amount.toFixed('8')} *${buyCurrency}* | ${buy.budget.toFixed('8')} *${sellCurrency}*\n`
)).join('')}
Total: ${(amount - remainingBudget).toFixed('8')} *${sellCurrency}*
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
	const key = await redis.get(getRedisKey('yobit', message.from.id, 'api_key'))
	const secret = await redis.get(getRedisKey('yobit', message.from.id, 'api_secret'))
	const found = `Keys and secrets can be found [here](https://yobit.io/en/api/keys/).`
	if (!key && !secret) {
		bot.sendMessage(message.chat.id, `\`api_key\` and \`api_secret\` are required to perform this action. Try \`/set api_key <YOUR_API_KEY>`` and \`/set api_secret <YOUR_API_SECRET>\`. ${found}`, { parse_mode: 'markdown' });
		return;
	}
	if (!key) {
		bot.sendMessage(message.chat.id, `\`api_key\` is required to perform this action. Try \`/set api_key <YOUR_API_KEY>``. ${found}`, { parse_mode: 'markdown' });
		return;
	}
	if (!secret) {
		bot.sendMessage(message.chat.id, `\`api_secret\` is required to perform this action. Try \`/set api_secret <YOUR_API_SECRET>\`. ${found}`, { parse_mode: 'markdown' });
		return;
	}
	let res
	try {
		res = await yobit.sendRequest({ method: 'getInfo' }, key, secret)
		console.log('response', res)
	} catch (e) {
		bot.sendMessage(message.chat.id, e.message);
		return;

	}
	bot.sendMessage(message.chat.id, `You've got ${res.transaction_count} transactions and ${res.open_orders} open orders`)
}

async function handleSetMessage (message, key, value) {
	const setKey = getRedisKey('yobit', message.from.id, key);
	await redis.set(setKey, value, 'EX', 86400); // Expire after 1 day
	bot.sendMessage(message.chat.id, `Key \`${key}\` successfully set for 1 day!`, { parse_mode: 'markdown' })
}

function getRedisKey (exchange, userId, key) {
	return `${env}_${exchange}_${userId}_${key}`;
}

function handlePollingError (error) {
	log.error('polling error', error)
}

process.on('unhandledRejection', log.crit)
