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

const respond = (req, res, text, forcePrivateResponse, extra_responses = []) => {
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
    let new_extra_responses = extra_responses.map(text => {
        return {
            ...response,
            text,
        }
    })
    response.extra_responses = new_extra_responses;
    return res.json(response);
};

module.exports = {
    checkToken,
    checkChannel,
    respond
};
