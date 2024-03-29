const axios = require("axios");
require('dotenv').config()

class Releasr {
    constructor() {
        this.url = process.env.RELEASR_URL;
    }

    async add(environment, version, note) {
        const postData = {
            environment,
            version,
            note
        };
        try {
            const {data} = await axios.post(this.url + '/notes', postData, {
                headers: {
                    "Content-Type": "application/json",
                }
            });
            return data;
        } catch (e) {
            return []
        }
    }

    async list(environment, version) {
        const params = {environment}
        if (version) {
            params.version = version;
        }
        const {data} = await axios.get(this.url + '/notes', {
            params,
            headers: {
                "Content-Type": "application/json",
            }
        });
        return data;
    }

    async complete(environment, version) {
        const postData = {
            environment,
            version,
        };
        const {data} = await axios.patch(this.url + '/notes', postData, {
            headers: {
                "Content-Type": "application/json",
            }
        });
        return data;
    }

    async list_envs() {
        const {data} = await axios.get(this.url + '/environments', {
            headers: {
                "Content-Type": "application/json",
            }
        });
        return data;
    }
}

module.exports = Releasr;
