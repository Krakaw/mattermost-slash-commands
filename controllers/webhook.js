const express = require('express');
const router = express.Router();
const {checkToken, respond} = require("../utils/mattermost");
const Mattermost = require('../utils/mattermost-post');

const {WEBHOOK_MM_KEY, WEBHOOK_MM_TEAM, WEBHOOK_MM_API_URL, WEBHOOK_MM_TOKEN} = process.env;

function processWebhookMessage(message, replacements = {}) {
    Object.keys(replacements).forEach(key => {
        const regex = new RegExp('\b'+key+'\b', 'gi');
        message = message.replace(regex, replacements[key]);
    });
    const parts = message.match(/<<<EOM\n*([\S\s]*?)\n*EOM/im);

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
    mm.create_post(WEBHOOK_MM_TEAM, req.body.channel, processWebhookMessage(req.body.body, req.body.replacements));
    return res.sendStatus(200);
});

module.exports = router;

