const express = require('express');
const PagerDuty = require("../utils/pagerduty");
const {checkToken, respond} = require("../utils/mattermost");
const {createTask} = require('./asana');
const {createPost, processWebhookMessage} = require('./webhook')
const router = express.Router();
const MM_TOKEN = process.env.PAGER_DUTY_MM_KEY;
const EMERGENCY_MESSAGE = process.env.EMERGENCY_MESSAGE || '';
const EMERGENCY_CHANNEL = process.env.EMERGENCY_CHANNEL;

const pagerDuty = new PagerDuty();

router.post("/", async function(req, res) {
    const {body: {text = "", user_name = null}} = req;

    const messageText = (text || '').trim();

    if (!checkToken(req, MM_TOKEN)) {
        return res.send("Not authorized");
    }
    let responseText = '';
    let forcePrivateResponse = true;
    if (messageText !== "") {
        let pdResponse = await pagerDuty.trigger(messageText, messageText);
        let assignees = pdResponse.data.incident.assignments.map(item => item.assignee.summary).join(", ");
        if (!EMERGENCY_CHANNEL) {
            responseText = `Pager Duty notification has been sent to ${assignees}!\n`;
            forcePrivateResponse = false;
        } else {
            createPost(EMERGENCY_CHANNEL, processWebhookMessage(JSON.parse(`"${EMERGENCY_MESSAGE}"`), { "%assignees%": assignees, "%user_name%": user_name, "%message%": messageText})).finally()
        }
        createTask(`THIS IS AN EMERGENCY: ${messageText}`, user_name).finally();
    } else {
        responseText = `To trigger an emergency please use /emergency [MESSAGE]\n`;
    }
    responseText += await getOnCall();
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
