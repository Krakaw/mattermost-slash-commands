const express = require('express');
const router = express.Router();

const moment = require("moment-timezone");
const MM_TOKEN = process.env.TIME_KEY;

const TIMEZONES = {
    "San Francisco": "America/Los_Angeles",
    "Nashville": "US/Central",
    "Florida": "EST",
    "Ontario": "EST",
    "Johannesburg": "Africa/Johannesburg",
    "Ukraine": "Europe/Kiev",
    "Turkey": "Europe/Istanbul"
};

const SLEEP_TIMES = [[18, 23], [0, 7]];

function between(v, min, max) {
    return v >= min && v <= max;
}

function generateString(name, timezone) {
    let m = moment().tz(timezone);
    let timeString = m.format("YYYY-MM-DD h:mm A");

    let emoji = "😮";
    for (let i in SLEEP_TIMES) {
        if (between(m.hour(), SLEEP_TIMES[i][0], SLEEP_TIMES[i][1])) {
            emoji = "😴";
        }
    }
    return `${name}: ${timeString} ${emoji}\n`;
}

router.get("/", function(req, res) {
    let data = "";
    for (let name in TIMEZONES) {
        data += generateString(name, TIMEZONES[name]);
    }
    return res.send(data);
});

module.exports = router;
