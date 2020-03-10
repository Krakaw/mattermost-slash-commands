const express = require('express');
const router = express.Router();
const {respond} = require("../utils/mattermost");
const axios = require("axios");
const Table = require('markdown-table')
router.post('/', async (req, res) => {
    const apiResult = await axios.get('https://wuhan-coronavirus-api.laeyoung.endpoint.ainize.ai/jhu-edu/latest');
    const {data} = apiResult;
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

    const tableData = [
        [
            "Country", "Confirmed 😷", "Deaths ☠️", "Recovered 🎉"
        ]
    ];

    Object.keys(results).forEach(country => {
        tableData.push([
            country,
            results[country].confirmed,
            results[country].deaths,
            results[country].recovered
        ])
    });


    const responseText = Table(tableData, {align: ['l', 'c', 'c', 'c']});
    return respond(req, res, responseText, true);
});
module.exports = router;
