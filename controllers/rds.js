const AWS = require('aws-sdk');
const express = require('express');
const router = express.Router();
const {checkToken, respond} = require("../utils/mattermost");

const MM_TOKEN = process.env.RDS_DUTY_MM_KEY;
const EC2_REGION = process.env.EC2_REGION || "eu-west-1"; //|| "us-west-2";
const RDS_CLUSTER_FILTER = process.env.RDS_CLUSTER_FILTER || "bigneon-dev-rds-rdsstack-1ktk4vgf5x3ll-dbcluster-1upyu9881qco";
const AUTHORIZED_USERS = (process.env.RDS_AUTHORIZED_USERS || "").split(",");
const AWS_ACCESS_KEY = process.env.AWS_ACCESS_KEY;
const AWS_SECRET_ACCESS_KEY = process.env.AWS_SECRET_ACCESS_KEY;
const RDS_WRITER_IDENTIFIER = process.env.RDS_WRITER_IDENTIFIER || '-rw-';
const RDS_READER_IDENTIFIER = process.env.RDS_READER_IDENTIFIER || '-ro-';
const RDS_MAX_READERS = process.env.RDS_MAX_READERS || 4;

const config = {
    region: EC2_REGION
};
if (AWS_ACCESS_KEY && AWS_SECRET_ACCESS_KEY) {
    config.accessKeyId = AWS_ACCESS_KEY;
    config.secretAccessKey = AWS_SECRET_ACCESS_KEY;
}
AWS.config.update(config);

const rds = new AWS.RDS({apiVersion: '2016-11-15'});

const postHandler = async (req, res) => {
    const {body: {user_name = null, text = ""}} = req;

    const messageText = (text || '').trim();

    const returnEarly = invalidAuth(req, res);
    if (returnEarly) {
        return returnEarly;
    }

    try {
        const dbInstances = await describeDBInstances();
        const dbs = getDbInstances(dbInstances);

        let responseText = '';
        let forcePrivateResponse = true;
        if (messageText !== "") {
            if (AUTHORIZED_USERS.indexOf(user_name) === -1) {
                return respond(req, res, "Unauthorized user");
            }
            if (messageText === "up") {
                let result = await appendROInstance(dbs);
                responseText += `I have started a new instance`;
            } else if (messageText === "down") {
                let result = await removeLastROInstance(dbs);
                responseText += `I have removed the latest instance`;
            } else {
                responseText = ``
            }
            forcePrivateResponse = false;
        } else {
            responseText = `To change the read only instances /rds up|down`;
        }

        responseText += `\n${formatDbs(dbs)}`;

        return respond(req, res, responseText, forcePrivateResponse);
    } catch (e) {
        return res.send(e);
    }


};

const invalidAuth = (req, res) => {
    const {body: {user_name = null, text = ""}} = req;

    const messageText = (text || '').trim();

    if (!checkToken(req, MM_TOKEN)) {
        return res.send("Not authorized");
    }

    if (messageText) {

    }

    return false;
}


async function describeDBInstances() {
    return new Promise((resolve, reject) => {
        rds.describeDBInstances(function (err, data) {
            if (err) {
                reject(err);
            } else {
                resolve(data);
            }
        });
    });
}

/**
 * Wrapper function to add a new db instance
 * @param dbs
 * @returns {Promise<unknown>}
 */
async function appendROInstance(dbs) {
    let readers = getReaders(dbs);
    let readOnlyInstance = readers[0];
    let DBClusterIdentifierBase = getBaseIdentifier(readOnlyInstance);
    let nextInstanceNumber = getNextInstanceNumber(readers);
    if (nextInstanceNumber >= RDS_MAX_READERS) {
        throw `You have reached your max readers of ${RDS_MAX_READERS}`;
    }

    let newDBInstanceIdentifier = `${DBClusterIdentifierBase}-${nextInstanceNumber}`
    let result = await addROInstance(newDBInstanceIdentifier, readOnlyInstance);
    return result;
}

async function addROInstance(newDBInstanceIdentifier, instance) {
    const {
        DBClusterIdentifier,
        Engine,
        DBInstanceClass
    } = instance;

    /**
     * @TODO Move this to .env
     * @type {*[]}
     */
    const Tags = [
        {
            Key: "Name",
            Value: newDBInstanceIdentifier
        },
        {
            Key: "ProvisionedBy",
            Value: "ChatOps"
        },
        {
            Key: "Stack",
            Value: "bigneon"
        },
        {
            Key: "Environment",
            Value: "production"
        }
    ];
    const params = {
        DBInstanceIdentifier: newDBInstanceIdentifier,
        DBClusterIdentifier,
        Engine,
        DBInstanceClass,
        CopyTagsToSnapshot: true,
        PromotionTier: 2,
        EnablePerformanceInsights: false,
        Tags

    };

    return new Promise((resolve, reject) => {
        rds.createDBInstance(params, function (err, data) {
            if (err) {
                reject(err);
            } else {
                resolve(data);
            }
        });
    });

}

async function removeLastROInstance(dbs) {
    let readers = getReaders(dbs);
    let readOnlyInstance = readers[0];
    let DBClusterIdentifierBase = getBaseIdentifier(readOnlyInstance);
    let nextInstanceNumber = getNextInstanceNumber(readers);
    if (nextInstanceNumber <= 1) {
        throw "No instances to remove, aborting";
    }
    let instanceNumberToRemove = nextInstanceNumber - 1;
    let DBInstanceIdentifierToRemove = `${DBClusterIdentifierBase}-${instanceNumberToRemove}`
    let result = await removeROInstance(DBInstanceIdentifierToRemove);
    return result;
}

async function removeROInstance(DBInstanceIdentifier) {
    const params = {
        DBInstanceIdentifier,
        SkipFinalSnapshot: true,
        DeleteAutomatedBackups: true
    };

    return new Promise((resolve, reject) => {
        rds.deleteDBInstance(params, function (err, data) {
            if (err) {
                reject(err);
            } else {
                resolve(data);
            }
        });
    });

}

function formatDbs(dbs) {
    let text = '';
    dbs.forEach(db => {
        text += `${db.DBName} | ${db.DBInstanceIdentifier} | ${db.DBInstanceClass} | ${db.DBInstanceStatus}\n`;
    });
    return text;
}

function getMaster(dbs) {
    return dbs.find(db => db.DBInstanceIdentifier.indexOf(RDS_WRITER_IDENTIFIER) > -1);
}

function getReaders(dbs) {
    return dbs.filter(db => db.DBInstanceIdentifier.indexOf(RDS_READER_IDENTIFIER) > -1);
}

function getBaseIdentifier(db) {
    let identifier = db.DBInstanceIdentifier;
    let parts = identifier.split("-");
    if (isNaN(parts[parts.length - 1])) {
        return identifier
    }
    return parts.slice(0, -1).join("-");
}

function getNextInstanceNumber(dbs) {
    let nextInstanceNumber = 0;
    dbs.forEach(db => {
        let lastPart = db.DBInstanceIdentifier.split('-').pop();
        if (isNaN(lastPart)) {
            nextInstanceNumber = 1;
        } else if (lastPart >= nextInstanceNumber) {
            nextInstanceNumber = +lastPart + 1;
        }
    });
    return nextInstanceNumber;
}

function getDbInstances(rawData) {
    return rawData.DBInstances.filter(db => db.DBClusterIdentifier === RDS_CLUSTER_FILTER) || [];
}

module.exports = router;
