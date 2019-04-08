require("dotenv").config();

const bodyParser = require('body-parser');
const express = require('express');
const app = express();
const port = process.env.PORT || 3000;
const fs = require("fs");

app.use(bodyParser.json()); // for parsing application/json
app.use(bodyParser.urlencoded({extended: true})); // for parsing application/x-www-form-urlencoded

app.post('/build', (req, res) => {
    const BUILD_KEY = process.env.BUILD_KEY;
    const AUTHORIZED_USERS = process.env.BUILD_AUTHORIZED_USERS.split(",");
    //Default to 15 minutes
    const TIME_BETWEEN_MODIFICATIONS = (process.env.BUILD_TIME_BETWEEN_MODIFICATION || 15) * 60 * 1000;
    const BUILD_OUTPUT_FILE = process.env.BUILD_OUTPUT_FILE;
    const BUILD_CURRENT_FILE = process.env.BUILD_CURRENT_FILE;

    const {body: {token = null, user_name = null, text = ""}} = req;

    let requestedServer = text.trim().toLowerCase();
    let currentSize = "Unknown";
    if (fs.existsSync(BUILD_CURRENT_FILE)) {
        currentSize = fs.readFileSync(BUILD_CURRENT_FILE, 'utf8');
    }
    if (!requestedServer) {
        //This is just polling for the current size
        return res.send(`The current drone build server size is \`${currentSize}\``);
    }

    //Only the authorized users can execute this function
    if (AUTHORIZED_USERS.indexOf(user_name) === -1) {
        return res.status(401).send("Unauthorized user");
    }

    //Mattermost sends a token, we expect a very specific one.
    if (!BUILD_KEY && token !== BUILD_KEY) {
        return res.status(401).send("Unauthorized token");
    }

    //Make sure that the file we are editing exists

    if (!fs.existsSync(BUILD_OUTPUT_FILE)) {
        return res.status(404).send("Invalid build output file path");
    }


    const stats = fs.statSync(BUILD_OUTPUT_FILE);
    //Make sure that the file is empty
    if (stats.size > 0) {
        return res.status(409).send(`The file must be empty before another modification can occur, please try again just now.`);
    }

    let timeSinceLastModification = (new Date()).getTime() - stats.mtimeMs;
    //Make sure we have not modified the file within the last X minutes
    if (timeSinceLastModification < TIME_BETWEEN_MODIFICATIONS) {
        return res.status(409).send(`The file can only be modified again in ${Math.round((TIME_BETWEEN_MODIFICATIONS - timeSinceLastModification) / 1000 / 60)} minutes`)
    }

    const types = {
        'slow':'c5.xlarge',
        'fast':'c5.2xlarge',
        'faster':'c5.4xlarge',
        'fastest':'c5.9xlarge',
    };

    let serverDescription = checkServerSize(types, requestedServer);

    let responseText = `Current Size: \`${currentSize}\`\nInvalid input \`${requestedServer}\`: /build [${Object.keys(types).join("|")}]`;

    if (serverDescription) {
        fs.writeFileSync(BUILD_OUTPUT_FILE, requestedServer, {encoding: 'utf8', flag: 'w'});
        responseText = `Old Size: \`${currentSize}\`\nThe build server has been set to ${requestedServer} - ${types[requestedServer]}`;
        res.send(responseText);
    } else {
        res.status(405).send(responseText);
    }

});

function checkServerSize(types, requestedType) {
    requestedType = requestedType.toLowerCase();
    return types[requestedType];
}

app.listen(port, () => console.log(`Example app listening on port ${port}!`));
