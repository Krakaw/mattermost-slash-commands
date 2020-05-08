const axios = require("axios");
require('dotenv').config()
class Pagerduty {
    constructor(inputs) {
        const options = Object.assign({
            serviceKey: process.env.PAGERDUTY_USER_API_KEY,
            serviceId: process.env.PAGERDUTY_TRIGGER_SERVICE_ID,
            serviceEmail: process.env.PAGERDUTY_FROM_EMAIL
        }, inputs || {});

        this.serviceKey = options.serviceKey;
        this.serviceId = options.serviceId;
        this.serviceEmail = options.serviceEmail;
    }

    trigger(title, description) {
        const data = {
            incident: {
                type: "incident",
                title,
                service: {
                    "id": this.serviceId,
                    "type": "service_reference"
                },

                "urgency": "high",
                "incident_key": "triggered_from_admin_panel_" + new Date(),
                "body": {
                    "type": "incident_body",
                    "details": description
                },
                // "priority": {
                // 	"id": "P53ZZH5",
                // 	"type": "priority_reference"
                // },
                // "escalation_policy": {
                // 	"id": "PGCJ8CM",
                // 	"type": "escalation_policy_reference"
                // }
            }
        };

        return this._postContent("incidents", data);
    }

    async list() {
        const {data} = await this._getContent("incidents?sort_by=created_at:desc&limit=10");
        return data;
    }

    async onCalls() {
        const {data} = await this._getContent("oncalls");
        return data;
    }

    /**
     * Generic'ish function to POST a url
     * @param url
     * @return {Promise}
     */
    _postContent(url, postData) {
        const headers = {
            "Accept": "application/vnd.pagerduty+json;version=2",
            "Content-Type": "application/json",
            "Authorization": `Token token=${this.serviceKey}`,
            "From": this.serviceEmail
        };
        return axios.post(`https://api.pagerduty.com/${url}` ,postData, {headers});
    }

    /**
     * Generic'ish function to GET a url
     * @param url
     * @return {Promise}
     */
    async _getContent(url) {
        const headers = {
            "Accept": "application/vnd.pagerduty+json;version=2",
            "Authorization": `Token token=${this.serviceKey}`,
        };
        return axios.get(`https://api.pagerduty.com/${url}`, {headers});
    }
}

module.exports = Pagerduty;
