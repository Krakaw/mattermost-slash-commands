const DEBUG = process.env.DEBUG;

const checkToken = (req, envToken) => {
    const compareToken = (envToken || '').trim();
    const {body: {token = null}} = req;
    return (compareToken && compareToken === token);
};

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
    respond
};
