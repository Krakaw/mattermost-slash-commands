const DEBUG = process.env.DEBUG;
const BYPASS_TOKEN = process.env.BYPASS_TOKEN;

const checkToken = (req, envToken) => {
    if (BYPASS_TOKEN === 'bypass') {
        return true;
    }
    const compareToken = (envToken || '').trim();
    const {body: {token = null}} = req;
    return (compareToken && compareToken === token);
};

const checkChannel = (req, channel) => {
    if (BYPASS_TOKEN === 'bypass') {
        return true;
    }
    const compareToken = (channel || '').trim();
    const {body: {channel_name = null}} = req;
    return (compareToken && compareToken === channel_name);
}

const respond = (req, res, text, forcePrivateResponse) => {
    const {body: {channel_id}} = req;
    const responseText = (text || '').trim();
    if (DEBUG) {
        console.log("Responding", responseText, channel_id);
    }
    let response = {text: responseText};
    if (!forcePrivateResponse && channel_id) {
        response.response_type = "in_channel";
        response.channel_id = channel_id;
    }
    return res.json(response);
};

module.exports = {
    checkToken,
    checkChannel,
    respond
};
