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
    const mm = new Mattermost(WEBHOOK_MM_API_URL, WEBHOOK_MM_TOKEN);
    const title = processWebhookMessage(req.body.title, req.body.replacements);
    const body = processWebhookMessage(req.body.body, req.body.replacements);
    let message = body;
    if (title) {
        message = `${title}\n${message}`;
    }
    if (req.body.noPost) {
        console.log(message)
    } else {
        mm.create_post(WEBHOOK_MM_TEAM, req.body.channel, message);
    }

    return res.sendStatus(200);
});

module.exports = router;

