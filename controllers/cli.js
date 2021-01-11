const express = require('express');
const router = express.Router();
const { exec } = require('child_process');
const {checkToken, respond} = require("../utils/mattermost");
const MM_TOKEN = process.env.CLI_MM_KEY;
const CLI_ALIASES = process.env.CLI_ALIAS;
const DEBUG = process.env.DEBUG;


router.post('/', async (req, res) => {
    const {body: {user_name = null, text = "", command = ""}} = req;
    const messageText = (text || '').trim().replace(/["'\\&|><]/g,'');
    const messageCommand = command.replace(/^\//, '').replace(/["'\\&|><]/g,'');

    if (!checkToken(req, MM_TOKEN)) {
        return res.send("Not authorized");
    }
    const [alias, cmd] = CLI_ALIASES.split('|');

    if (alias !== messageCommand) {
        return respond(req,res,"Invalid command");
    }
    exec(`./${cmd} "${messageText}"`, (err, stdout, stderr) => {
        return respond(req, res, err || stderr || stdout || '', true);
    })

});
module.exports = router;
