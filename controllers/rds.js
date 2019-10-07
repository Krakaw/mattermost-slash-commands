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
const RDS_WRITER_IDENTIFIER = process.env.RDS_WRITER_IDENTIFIER;
const RDS_READER_IDENTIFIER = process.env.RDS_READER_IDENTIFIER;

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



    const dbInstances = await describeDBInstances();
    const dbs = getDbInstances(dbInstances);

    let responseText = '';
    if (messageText !== "") {

    } else {

    }
    responseText += formatDbs(dbs);
    return respond(req, res, responseText, forcePrivateResponse);



};

const invalidAuth = (req, res) => {
    const {body: {user_name = null, text = ""}} = req;

    const messageText = (text || '').trim();

    if (!checkToken(req, MM_TOKEN)) {
        return res.send("Not authorized");
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

async function addROInstance(newDBInstanceIdentifier, instance) {
    const {
        DBClusterIdentifier,
        Engine,
        DBInstanceClass
    } = instance;

    const params = {
        DBInstanceIdentifier: newDBInstanceIdentifier,
        DBClusterIdentifier,
        Engine,
        DBInstanceClass
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
    if (isNaN(parts[parts.length -1])) {
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
        } else if(lastPart >= nextInstanceNumber) {
            nextInstanceNumber = lastPart +1;
        }
    })
}

function getDbInstances(rawData) {
    return rawData.DBInstances.filter(db => db.DBClusterIdentifier === RDS_CLUSTER_FILTER) || [];
}


postHandler((e, r) => {
    // console.log(JSON.stringify(r));
});


module.exports = router;

/*
router.post("/", async function (req, res) {
    const {body: {user_name = null, text = ""}} = req;

    const messageText = (text || '').trim();

    if (!checkToken(req, MM_TOKEN)) {
        return res.send("Not authorized");
    }

    try {
        let ingressAcls = getIngressEntries(await describeNetworkAcls());
        let responseText = '';
        let forcePrivateResponse = true;

        if (messageText !== "") {
            if (AUTHORIZED_USERS.indexOf(user_name) === -1) {
                return respond(req, res, "Unauthorized user");
            }

            const [ip, d = ""] = messageText.split(" ");
            if (d.trim()) {
                const ruleNumberFromIp = getRuleNumberFromIp(ip, ingressAcls);
                await deleteRule(ruleNumberFromIp);
                responseText = `${ip} has been removed from firewall by ${user_name}!\n`;
            } else {
                await addRule(ip, nextRuleNumber(ingressAcls));
                responseText = `${ip} has been blocked by ${user_name}!\n`;
            }

            ingressAcls = getIngressEntries(await describeNetworkAcls());
            forcePrivateResponse = false;
        } else {
            responseText = `To update the firewall /firewall IP.AD.DR.ES [d]\n`;
        }

        responseText += formatAcls(ingressAcls);
        return respond(req, res, responseText, forcePrivateResponse);
    }catch(e) {
        return res.send(e);
    }


});

async function addRule(ip, RuleNumber) {
    validRuleNumber(RuleNumber);

    const CidrBlock = `${ip}/32`;
    const params = {
        DryRun: false,
        Egress: false,
        Protocol: '-1',
        RuleAction: "deny",
        NetworkAclId: ACL_ID,
        RuleNumber,
        CidrBlock
    };
    return new Promise((resolve, reject) => {
        ec2.createNetworkAclEntry(params, ((err, data) => {
            if (err) {
                reject(err);
            } else {
                resolve(data);
            }
        }));
    });
}

async function deleteRule(RuleNumber) {
    validRuleNumber(RuleNumber);

    const params = {
        DryRun: false,
        Egress: false,
        NetworkAclId: ACL_ID,
        RuleNumber
    };
    return new Promise((resolve, reject) => {
        ec2.deleteNetworkAclEntry(params, ((err, data) => {
            if (err) {
                reject(err);
            } else {
                resolve(data);
            }
        }));
    });
}

async function describeNetworkAcls() {
    const params = {
        DryRun: false,
        Filters: [{Name: "association.network-acl-id", Values: [ACL_ID]}]
    };
    return new Promise((resolve, reject) => {
        ec2.describeNetworkAcls(params, function (err, data) {
            if (err) {
                reject(err);
            } else {
                resolve(data);
            }
        });
    });
}

function getRuleNumberFromIp(ip, ingressAcls) {
    const CidrBlock = `${ip}/32`;
    return (ingressAcls.find(acl => acl.CidrBlock === CidrBlock) || {}).RuleNumber || 0;
}

function nextRuleNumber(ingressAcls) {
    const lastRuleNumber = (ingressAcls.find(acl => acl.RuleNumber >= FIREWALL_MIN_RULE_NUMBER && acl.RuleNumber <= FIREWALL_MAX_RULE_NUMBER) || {}).RuleNumber;
    if (lastRuleNumber) {
        return lastRuleNumber + 1;
    }
    return FIREWALL_MIN_RULE_NUMBER;
}

function validRuleNumber(RuleNumber) {
    if (RuleNumber >= FIREWALL_MIN_RULE_NUMBER && RuleNumber <= FIREWALL_MAX_RULE_NUMBER) {
        return true;
    }
    throw `Invalid RuleNumber: ${RuleNumber} - Must be between ${FIREWALL_MIN_RULE_NUMBER} and ${FIREWALL_MAX_RULE_NUMBER}`;
}

function formatAcls(ingressAcls) {
    let text = '';
    ingressAcls.forEach(acl => {
        text += `${acl.CidrBlock} | ${acl.RuleAction} | ${acl.RuleNumber}\n`;
    });
    return text;
}

function getIngressEntries(acls) {
    let entries = [];
    acls.NetworkAcls.forEach(acl => {
        entries = entries.concat(acl.Entries.filter(acl => acl.Egress === false));
    });
    return entries;
}

 */
