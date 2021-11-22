const axios = require("axios");

class Mattermost {
    constructor(apiUrl, personalToken) {
        this.apiUrl = apiUrl;
        this.personalToken = personalToken;
        this.teams = null;
        this.channelMap = null;
    }

    /**
     * Make a generic API call. Returns a promise
     * @param method, GET, POST etc
     * @param endpoint 'users', 'channels' etc
     * @param data - a JSON object that will get added to post requests
     */
    async api(method, endpoint, data) {
        const options = {
            method: method.toLowerCase(),
            url: `${this.apiUrl}/${endpoint}`,
            headers: {
                "Authorization": `Bearer ${this.personalToken}`,
                "Accept": "application/json",
                "Content-Type": "application/json"
            }
        };
        if (data) {
            options.data = data;
        }
        const res = await axios(options);

        return res.data;
    }

    /**
     * Only returns the public teams, unless this is an admin user
     */
    async get_teams(force = false) {
        if (!force && this.teams) {
            return this.teams;
        }
        this.teams = await this.api("get", "teams");
        return this.teams;
    }

    async get_team_by_name(teamName) {
        return await this.api("get", `teams/name/${teamName}`);
    }

    async get_users() {
        return await this.api("get", "users");
    }

    async get_channels(teamId, page = 0) {
        let id = teamId;
        if (!teamId) {
            const teams = await this.get_teams(true);
            id = teams[0].id;
        }
        try {
            const channels = await this.api("get", `teams/${id}/channels?per_page=250&page=${page}`);

            this.channelMap = {};
            channels.forEach(ch => {
                this.channelMap[ch.name] = {
                    id: ch.id,
                    name: ch.name,
                    displayName: ch.display_name
                };
            });
            if (channels.length) {
                await this.get_channels(teamId, page + 1);
            }


        }catch{}

    }

    /**
     * Post a message to a public channel
     * @param team - the team name
     * @param channel - the channel name (as a slug)
     * @param message - can be markdown
     * @param reloadChannels - force reload of channels before attempting to post
     * @returns {Promise<void>}
     */
    async create_post(team, channel, message, reloadChannels = false) {
        const team_id = await this.get_team_by_name(team);
        if (!this.channelMap || reloadChannels) {
            await this.get_channels(team_id.id);
        }

        const ch = this.channelMap[channel] || {id: channel};
        if (!ch) {
            throw new Error(`Unknown channel: ${channel}`);
        }
        const data = {
            channel_id: ch.id,
            message: message
        };
        return await this.api("post", "posts", data);
    }
}

module.exports = Mattermost;
