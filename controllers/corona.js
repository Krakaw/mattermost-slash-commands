const express = require('express');
const router = express.Router();
const {respond} = require("../utils/mattermost");
const axios = require("axios");
const Table = require('markdown-table');
const cheerio = require("cheerio");
const cache = {
    expires: 0,
    data: false,
};

const countries = ['US', 'USA', 'South Africa', 'Canada', 'Serbia'];
const worldometers = async () => {

    let apiData;
    try {
        200 !== (apiData = await axios.get("https://www.worldometers.info/coronavirus/")).status && console.log("Error", apiData.status)
    } catch (e) {
        return null
    }
    const results = {},
        $ = cheerio.load(apiData.data),
        rows = $("table#main_table_countries_today tbody tr");
    rows.each((i, elem) => {
        const row = [];
        $(elem).children("td").each((i, elem) => {
            console.log($(elem).text())
            row.push($(elem).text().trim().replace(/,/g, ""))
        });
        if (countries.indexOf(row[0]) > -1) {
            results[row[0]] = {
                confirmed: row[1] || 0,
                deaths: row[3] || 0,
                recovered: row[5] || 0
            };
        }


    });
    return results;
};

const getHarvard = async () => {
    const apiResult = await axios.get('https://wuhan-coronavirus-api.laeyoung.endpoint.ainize.ai/jhu-edu/latest');
    const {data} = apiResult;
    const results = {};
    data.forEach(infected => {
        const {countryregion, confirmed = 0, deaths = 0, recovered = 0} = infected;
        if (countries.indexOf(countryregion) > -1) {
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
    return results;
};

router.post('/', async (req, res) => {
    const now = new Date();

    if (now > cache.expires) {
        //Re pull the data
        const apiResult = await worldometers();
        cache.data = apiResult;
        cache.expires = now.getTime() + (15 * 60 * 1000);
    }

    const tableData = [];
    Object.keys(cache.data).forEach(country => {
        tableData.push([
            country,
            cache.data[country].confirmed,
            cache.data[country].deaths,
            cache.data[country].recovered
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
