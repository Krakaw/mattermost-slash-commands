const express = require('express');
const router = express.Router();
const asana = require('asana');
const {checkToken, respond} = require("../utils/mattermost");

const asanaPersonalToken = process.env.ASANA_PERSONAL_TOKEN;
const asanaProjectIds = {};
process.env.ASANA_PROJECT_ID.split('|').map(s => s.split(':')).forEach(([board, id, mmToken]) => {
    asanaProjectIds[board] = {id, mmToken};
});
const asanaWorkspaceId = process.env.ASANA_WORKSPACE_ID;
const asanaBoardId = process.env.ASANA_BOARD_ID;
const asanaTagId = process.env.ASANA_TAG_ID;

const client = asana.Client.create({defaultHeaders: {'Asana-Enable': 'string_ids'}}).useAccessToken(asanaPersonalToken);
router.post("/:board", async function (req, res) {
    const board = req.params.board;
    const asanaProject = asanaProjectIds[board];
    if (!checkToken(req, asanaProject.mmToken)) {
        return res.send("Not authorized");
    }

    let message = 'Your request has been submitted';
    try {
        const {body: {user_name = null, text = ""}} = req;

        const messageText = (text || '').trim();
        if (!messageText) {
            message = 'Message cannot be blank'
        } else {
            if (!asanaProjectIds[board]) {
                throw Error(`${board} does not exist`);
            }

            const task = await createTask(asanaProject.id, messageText, user_name);
            message += ' ' + task.permalink_url;
        }
    } catch (e) {
        console.error(e)
        message = 'There was an error submitting your request';
    }
    return respond(req, res, message, true);

})
const createTask = async (asanaProjectId, messageText, user_name) => {
    const task = await client.tasks.createTask({
        name: `${messageText} - ${user_name}`,
        projects: [asanaProjectId],
        workspace: asanaWorkspaceId,
        tags: [asanaTagId]
    });
    await client.sections.addTaskForSection(asanaBoardId, {task: task.gid});
    return task;
}
module.exports = {router, createTask};
