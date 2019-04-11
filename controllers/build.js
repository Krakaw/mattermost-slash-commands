const express = require('express');
const router = express.Router();
const fs = require("fs");

/** Server types */
const TYPE_SLOW = "slow";
const TYPE_FAST = "fast";
const TYPE_FASTER = "faster";
const TYPE_FASTEST = "fastest";

/** Environment variables */
const DEBUG = process.env.DEBUG;
const BUILD_KEY = process.env.BUILD_KEY;
const AUTHORIZED_USERS = (process.env.BUILD_AUTHORIZED_USERS || "").split(",");
//Default to 15 minutes
const TIME_BETWEEN_MODIFICATIONS = (process.env.BUILD_TIME_BETWEEN_MODIFICATION || 15) * 60 * 1000;
//Where we place the output from the script
const BUILD_OUTPUT_FILE = process.env.BUILD_OUTPUT_FILE;
//Where we read the current server size from
const BUILD_CURRENT_FILE = process.env.BUILD_CURRENT_FILE;

router.post('/', (req, res) => {
    const {body: {token = null, user_name = null, text = "", channel_id}} = req;

    let requestedServerType = text.trim().toLowerCase();
    let currentName = getCurrentServerName();
    let currentType = getTypeFromName(currentName);
    let currentDescription = getCompleteDescription(currentType);
    if (DEBUG) {
        console.log(req.body);
        console.log("Authorized Users:", AUTHORIZED_USERS);
        console.log("requestedServerType", requestedServerType);
        console.log("currentName", currentName);
        console.log("currentType", currentType);
        console.log("currentDescription", currentDescription);
    }
    //This is just polling for the current size
    if (!requestedServerType) {
        return respond(res, `Current Drone is: \`${currentDescription}\``);
    }

    const queryIsValid = validateUserCanChange(res, user_name, token);
    if (queryIsValid === true) {
        let responseText = "";
        if (types(requestedServerType)) {
            //It is a valid query, change the server size
            setServerSize(requestedServerType);
            responseText = `Old Size: \`${currentName}\`\n${getCompleteDescription(requestedServerType)}`;
            return respond(res, responseText, channel_id);
        } else {
            responseText = `Current Size: \`${currentName}\`\nInvalid input \`${requestedServerType}\`: /build [${Object.keys(types).join("|")}]`;
            return respond(res, responseText);
        }

    } else {
        return queryIsValid;
    }
});

function validateUserCanChange(res, user_name, token) {
    //Only the authorized users can execute this function
    if (AUTHORIZED_USERS.indexOf(user_name) === -1) {
        return respond(res, "Unauthorized user");
    }

    //Mattermost sends a token, we expect a very specific one.
    if (!BUILD_KEY && token !== BUILD_KEY) {
        return respond(res, "Unauthorized mattermost token");
    }

    //Make sure that the file we are editing exists
    if (!fs.existsSync(BUILD_OUTPUT_FILE)) {
        return respond(res, "Invalid build output file path");
    }

    const stats = fs.statSync(BUILD_OUTPUT_FILE);
    //Make sure that the file is empty
    if (stats.size > 0) {
        return respond(res, `The file must be empty before another modification can occur, please try again just now.`);
    }

    let timeSinceLastModification = (new Date()).getTime() - stats.mtimeMs;
    //Make sure we have not modified the file within the last X minutes
    if (timeSinceLastModification < TIME_BETWEEN_MODIFICATIONS) {
        return respond(res, `The file can only be modified again in ${Math.round((TIME_BETWEEN_MODIFICATIONS - timeSinceLastModification) / 1000 / 60)} minutes`)
    }

    return true;
}

function setServerSize(newSize) {
    fs.writeFileSync(BUILD_OUTPUT_FILE, newSize, {encoding: 'utf8', flag: 'w'});
}

function getCurrentServerName() {
    let currentSize = "Unknown";
    if (fs.existsSync(BUILD_CURRENT_FILE)) {
        currentSize = fs.readFileSync(BUILD_CURRENT_FILE, 'utf8').trim();
        currentSize = currentSize.split(" ")[4].trim();
    }
    return currentSize;
}

function getTypeFromName(name) {
    name = name.trim();
    let NAMES = names();
    for (let type in NAMES) {
        let typeName = NAMES[type];
        if (typeName === name) {
            return type;
        }
    }
    return null;
}

function getCompleteDescription(type) {
    let description = descriptions(type);
    if (description) {
        description = `${description} - \$${prices(type)}/h - \$${prices(type) * 720}/month`;
    }
    return description;
}

function types(type) {
    const TYPES = {
        [TYPE_SLOW]: TYPE_SLOW,
        [TYPE_FAST]: TYPE_FAST,
        [TYPE_FASTER]: TYPE_FASTER,
        [TYPE_FASTEST]: TYPE_FASTEST,
    };
    if (type) {
        return TYPES[type];
    }
    return TYPES;
}

function names(type) {
    const NAMES = {
        [TYPE_SLOW]: `c5.xlarge`,
        [TYPE_FAST]: `c5.2xlarge`,
        [TYPE_FASTER]: `c5.4xlarge`,
        [TYPE_FASTEST]: `c5.9xlarge`,
    };

    if (type) {
        return NAMES[type];
    }
    return NAMES;
}

function descriptions(type) {
    const DESCRIPTIONS = {
        [TYPE_SLOW]: `${TYPE_SLOW} - c5.xlarge`,
        [TYPE_FAST]: `${TYPE_FAST} - c5.2xlarge`,
        [TYPE_FASTER]: `${TYPE_FASTER} - c5.4xlarge`,
        [TYPE_FASTEST]: `${TYPE_FASTEST} - c5.9xlarge`,
    };

    if (type) {
        return DESCRIPTIONS[type];
    }
    return DESCRIPTIONS;
}

function prices(type) {
    const PRICES = {
        [TYPE_SLOW]: 0.17,
        [TYPE_FAST]: 0.34,
        [TYPE_FASTER]: 0.68,
        [TYPE_FASTEST]: 1.53,
    };

    if (type) {
        return PRICES[type];
    }
    return PRICES;
}

function respond(res, text, channel_id) {
    text = text.trim();
    if (DEBUG) {
        console.log("Responding", text, channel_id);
    }
    let response = {text};
    if (channel_id) {
        response.response_type = "in_channel";
        response.channel_id = channel_id;
    }
    return res.json(response);
}

module.exports = router;
