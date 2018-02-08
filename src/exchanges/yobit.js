const crypto = require('crypto');
const Promise = require('bluebird');
const request = Promise.promisify(require('request'));

const nonce = {}

function generateNonce (key) {
	return Math.floor(Date.now() / 1000);
	/*
	nonce[key] = (nonce[key] || 0) + 1
	return nonce[key]
	*/
}

function signMessage (params, secret) {
	const data = Object.keys(params).reduce((res, key) => {
		res.push(`${key}=${params[key]}`);
		return res;
	}, []).join('&');
	return crypto.createHmac('sha512', secret).update(data).digest('hex');
}

async function sendPublicRequest (action) {
	const { body, statusCode } = await request({
		method: 'GET',
		url: `https://yobit.net/api/3/${action}`
	})
	if (statusCode !== 200) {
		throw new Error(`invalid status code ${statusCode} for request (response body: ${body} )`);
	}
	let resposne;
	try {
		response = JSON.parse(body);
	} catch (e) {
		throw new Error(`cannot parse response body: not JSON, got: ${body}`);
	}
	return response;
}

async function sendRequest (params, key, secret) {
	const form = Object.assign({
		nonce: generateNonce(key),
	}, params);
	const sign = signMessage(form, secret)
	const { body, statusCode } = await request({
		method: 'POST',
		url: 'https://yobit.net/tapi',
		headers: { key, sign },
		form,
	});

	if (statusCode === 503 && body && /cloudflare/i.exec(body)) {
		throw new Error('request failed: couldflare protection is enabled')
	}

	if (statusCode !== 200) {
		throw new Error(`invalid status code ${statusCode} for request (response body: ${body} )`);
	}
	let resposne;
	try {
		response = JSON.parse(body);
	} catch (e) {
		throw new Error(`cannot parse response body: not JSON, got: ${body}`);
	}
	if (response.success !== 1) {
		throw new Error(`response has error: ${response.error}`);
	}
	return response.return;
}

module.exports = {
	sendRequest,
	sendPublicRequest,
};
