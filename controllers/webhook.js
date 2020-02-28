const express = require('express');
const router = express.Router();
const {checkToken, respond} = require("../utils/mattermost");
const Mattermost = require('../utils/mattermost-post');

const {WEBHOOK_MM_KEY, WEBHOOK_MM_TEAM, WEBHOOK_MM_API_URL, WEBHOOK_MM_TOKEN} = process.env;

router.post('/', async function(req,res) {
    if (!checkToken(req, WEBHOOK_MM_KEY)) {
        return res.sendStatus(401);
    }
    const mm = new Mattermost(WEBHOOK_MM_API_URL, WEBHOOK_MM_TOKEN);
    mm.create_post(WEBHOOK_MM_TEAM, req.body.channel, req.body.body);
    return res.sendStatus(200);
});

module.exports = router;

