const opsGenie = require("opsgenie-sdk");

class OpsGenie {
    constructor({apiKey, responders = []}) {
        this.opsGenie = opsGenie;
        this.responders = responders;
        opsGenie.configure({
            api_key: apiKey,
        });
    }

    trigger(message, description) {
        this.opsGenie.alertV2.create({
            message, description, priority: "P2", responders: this.responders, tags: ["panic"]
        }, {}, (_r) => {
        })
    }
}

module.exports = OpsGenie
