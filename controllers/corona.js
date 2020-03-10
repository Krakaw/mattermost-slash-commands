const express = require('express');
const router = express.Router();
const {respond} = require("../utils/mattermost");
const axios = require("axios");
const Table = require('markdown-table');
const cache = {
    expires: 0,
    data: false,
};
router.post('/', async (req, res) => {
    const now = new Date();

    if (now > cache.expires) {
        //Re pull the data
        const apiResult = await axios.get('https://wuhan-coronavirus-api.laeyoung.endpoint.ainize.ai/jhu-edu/latest');
        const {data} = apiResult;
        cache.data = data;
        cache.expires = now + (15 * 60 * 1000);
    }

    const {data} = cache;
    const results = {};
    const countryRegions = ["US", 'South Africa', 'Canada'];
    data.forEach(infected => {
        const {countryregion, confirmed = 0, deaths = 0, recovered = 0} = infected;
        if (countryRegions.indexOf(countryregion) > -1) {
            if (!results.hasOwnProperty(countryregion)) {
                results[countryregion] = {
                    "confirmed": 0,
                    "deaths": 0,
                    "recovered": 0
                };
            }
            results[countryregion].confirmed += confirmed;
            results[countryregion].deaths += deaths;
            results[countryregion].recovered += recovered;
        }
    });

    const tableData = [];
    Object.keys(results).forEach(country => {
        tableData.push([
            country,
            results[country].confirmed,
            results[country].deaths,
            results[country].recovered
        ])
    });
    tableData.sort((a, b) => a.confirmed > b.confirmed ? 1 : -1);
    tableData.unshift([
        "Country", "Confirmed 😷", "Deaths ☠️", "Recovered 🎉"
    ]);


    const responseText = Table(tableData, {align: ['l', 'c', 'c', 'c']});
    return respond(req, res, responseText, true);
});
module.exports = router;
