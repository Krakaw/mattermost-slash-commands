const express = require('express');
const OpsGenie = require('../utils/opsgenie');
const {checkToken, respond} = require("../utils/mattermost");
const {createTask} = require('./asana');
const {createPost, processWebhookMessage} = require('./webhook')
const router = express.Router();
const OPS_GENIE_TOKEN = process.env.OPS_GENIE_TOKEN;
const OPS_GENIE_RESPONDERS = process.env.OPS_GENIE_RESPONDERS.split(',').map(r => {
    const [id, type] = r.split('|');
    return {id, type}
})
const MM_TOKEN = process.env.OPS_GENIE_MM_KEY;

const EMERGENCY_MESSAGE = process.env.EMERGENCY_MESSAGE || '';
const EMERGENCY_CHANNEL = process.env.EMERGENCY_CHANNEL;

const opsGenie = new OpsGenie({apiKey: OPS_GENIE_TOKEN, responders: OPS_GENIE_RESPONDERS});

router.post("/", async function(req, res) {
    const {body: {text = "", user_name = null}} = req;

    const messageText = (text || '').trim();

    if (!checkToken(req, MM_TOKEN)) {
        return res.send("Not authorized");
    }

    let responseText = '';
    let forcePrivateResponse = true;
    if (messageText !== "") {
        let _pdResponse = await opsGenie.trigger('Mattermost Panic!', messageText);
        if (!EMERGENCY_CHANNEL) {
            responseText = `OpsGenie notification has been sent!\n`;
            forcePrivateResponse = false;
        } else {
            createPost(EMERGENCY_CHANNEL, processWebhookMessage(JSON.parse(`"${EMERGENCY_MESSAGE}"`), { "%assignees%":'On-call Staff', "%user_name%": user_name, "%message%": messageText})).finally()
        }
        // createTask(`THIS IS AN EMERGENCY: ${messageText}`, user_name).finally();
    } else {
        responseText = `To trigger an emergency please use /emergency [MESSAGE]\n`;
    }
    // responseText += await getOnCall();
    return respond(req, res, responseText, forcePrivateResponse);

});

async function getOnCall() {
    let data = await pagerDuty.onCalls();
    let oncalls = [];
    (data.oncalls || []).forEach(oncall => {
        oncalls.push(`${oncall.user.summary} - ${oncall.schedule.summary}`);
    });
    let response = oncalls.reverse().join("\n");
    return response;
}

module.exports = router;
