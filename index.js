require("dotenv").config();

const bodyParser = require('body-parser');
const express = require('express');
const app = express();
const port = process.env.PORT || 3000;

// Controllers
const build = require("./controllers/build");
const time = require("./controllers/time");

app.use(bodyParser.json()); // for parsing application/json
app.use(bodyParser.urlencoded({extended: true})); // for parsing application/x-www-form-urlencoded

app.use("/build", build);
app.use("/time", time);

app.get("/", (req, res) => {
    return res.send("/build or /time");
});

app.listen(port, () => console.log(`Mattermost slash command bot listening on port ${port}!`));
