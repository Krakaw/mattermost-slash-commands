const express = require('express');
const router = express.Router();
const {checkToken, checkChannel, respond} = require("../utils/mattermost");
const Releasr = require('../utils/releasr');
const MM_TOKEN = process.env.RELEASE_MM_KEY;
const MM_CHANNEL = process.env.RELEASE_MM_CHANNEL;

router.post("/", async function(req, res) {
    if (!checkToken(req, MM_TOKEN)) {
        return res.send("Not authorized");
    }
    if (!checkChannel(req, MM_CHANNEL)) {
        return res.send("Only authorized channels can send commands");
    }

    const releasr = new Releasr();
    const {body: {text = "", user_name = null}} = req;
    const messageText = (text || '').trim();
    const [command, env, version, ...note] = messageText.replace(/\s{2,}/g, ' ').split(' ')

    let responseText = '';
    switch(command.toLowerCase()) {
        case 'add': {
            if (!env || !version) {
                responseText = `Invalid command: add env version note [add dev 1.0.0 Release Note]`;
                break;
            }
            const data = await releasr.add(env, version, note.join(' '));
            if (data && data.length) {
                responseText = `Note${data.length > 1? 's': ''} added for version: ${version} on ${data.map(n => n.environment).join(', ')}\nUse the "list" command to view notes`
            } else {
                responseText = `There was an error adding the note ${data}`
            }
            break;
        }
        case 'complete': {
            const data = await releasr.complete(env, version, note);
            responseText = `${data.completed_count} notes up to version ${version} on ${env} have been marked as complete`;
            break;
        }
        case 'list': {
            const data = await releasr.list(env, version)
            responseText = data.map(note => {
                return `## ${note.version}\n${note.note}`
            }).join("\n");
            break;
        }
        default:
            responseText = 'Invalid command: expected [add|list|complete]'
    }


    // List notes for env + version
    // Add note for env + version
    // Complete notes for env + version


    return respond(req, res, responseText, false);
});
module.exports = router;
