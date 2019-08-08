const express = require('express');
const PagerDuty = require("../models/pagerduty");

const router = express.Router();
const MM_TOKEN = process.env.PAGER_DUTY_MM_KEY;
const pagerDuty = new PagerDuty();

router.post("/", async function(req, res) {
    const {body: {token = null, user_name = null, text = "", channel_id}} = req;

    if (MM_TOKEN !== token) {
        return res.send("Not authorized");
    }
    if (text !== "") {
        await pagerDuty.trigger(text, text);
        return res.send("Pager Duty notification has been sent!");
    } else {
        let data = await pagerDuty.onCalls();
        let oncalls = [];
        (data.oncalls || []).forEach(oncall => {
            oncalls.push(`${oncall.user.summary} - ${oncall.schedule.summary}`);
        });
        let response = `To trigger an emergency please use /emergency [MESSAGE]\n`;
        response += oncalls.reverse().join("\n");

        return res.send(response);
    }

});

module.exports = router;
