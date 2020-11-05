require("dotenv").config();

const bodyParser = require('body-parser');
const express = require('express');
const app = express();
const port = process.env.PORT || 3000;
const DEBUG = process.env.DEBUG;

// Controllers
const build = require("./controllers/build");
const time = require("./controllers/time");
const chat = require("./controllers/chat");
const emergency = require("./controllers/emergency");
const firewall = require("./controllers/firewall");
const rds = require("./controllers/rds");
const webhook = require("./controllers/webhook");
const corona = require("./controllers/corona");
const asana = require("./controllers/asana");

app.use(bodyParser.json()); // for parsing application/json
app.use(bodyParser.urlencoded({extended: true})); // for parsing application/x-www-form-urlencoded

app.use((req, res, next) => {
    if (DEBUG) {
        console.debug( req.originalUrl, req.body);
    }
    next();
});
app.use("/asana", asana.router);
app.use("/build", build);
app.use("/time", time);
app.use("/chat", chat);
app.use("/emergency", emergency);
app.use("/firewall", firewall);
app.use("/rds", rds);
app.use("/webhook", webhook.router);
app.use("/corona", corona)
app.get("/", (req, res) => {
    return res.send("You know what you should do");
});

app.listen(port, () => console.log(`Mattermost slash command bot listening on port ${port}!`));
