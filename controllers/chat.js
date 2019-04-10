const express = require('express');
const router = express.Router();

router.post("/", function(req, res) {
    let parts = req.body.text.trim().split(" ");
    let channel_id = req.body.user_id;

    let delay = 5000;
    let text = parts[0];
    if (parts.length > 1) {
        delay = parts[0];
        text = parts[1];
    }

    res.header()
    setTimeout(() => {
        res.json({response_type: "in_channel", channel_id, text})
    }, delay);
});

module.exports = router;
