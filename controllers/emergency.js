const express = require('express');
const PagerDuty = require("../utils/pagerduty");
const {checkToken, respond} = require("../utils/mattermost");
const router = express.Router();
const MM_TOKEN = process.env.PAGER_DUTY_MM_KEY;
const pagerDuty = new PagerDuty();

router.post("/", async function(req, res) {
    const {body: {text = ""}} = req;

    const messageText = (text || '').trim();

    if (!checkToken(req, MM_TOKEN)) {
        // return res.send("Not authorized");
    }
    let responseText = '';
    let forcePrivateResponse = true;
    if (messageText !== "") {
        let pdResponse = await pagerDuty.trigger(messageText, messageText);
        let assignees = pdResponse.data.incident.assignments.map(item => item.assignee.summary).join(", ");
        responseText = `Pager Duty notification has been sent to ${assignees}!\n`;
        forcePrivateResponse = false;
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
