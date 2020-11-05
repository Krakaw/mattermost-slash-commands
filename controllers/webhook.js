const express = require('express');
const router = express.Router();
const {checkToken, respond} = require("../utils/mattermost");
const Mattermost = require('../utils/mattermost-post');

const {WEBHOOK_MM_KEY, WEBHOOK_MM_TEAM, WEBHOOK_MM_API_URL, WEBHOOK_MM_TOKEN} = process.env;

function processWebhookMessage(message, replacements = {}) {
    Object.keys(replacements).forEach(key => {
        const regex = new RegExp(key, 'gm');
        message = message.replace(regex, replacements[key]);
    });
    const parts = message.match(/<<EOM\n*([\S\s]*?)\n*EOM/m);

    if (parts) {
        return parts[1];
    } else {
        return message;
    }
}

router.post('/', async function(req,res) {
    if (!checkToken(req, WEBHOOK_MM_KEY)) {
        return res.sendStatus(401);
    }

    const {title, body, replacements, channel, noPost} = req.body;
    const titleText = processWebhookMessage(title,replacements);
    const bodyText = processWebhookMessage(body, replacements);
    let message = bodyText;
    if (titleText) {
        message = `${titleText}\n${message}`;
    }
    if (noPost) {
        console.log(message)
    } else {
        createPost(channel, message).finally()
    }

    return res.sendStatus(200);
});

const createPost = async (channel, message) => {
    const mm = new Mattermost(WEBHOOK_MM_API_URL, WEBHOOK_MM_TOKEN);
    return await mm.create_post(WEBHOOK_MM_TEAM, channel, message);
}
module.exports = {router, createPost, processWebhookMessage};

