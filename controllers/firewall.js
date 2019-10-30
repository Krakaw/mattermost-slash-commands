const AWS = require('aws-sdk');
const express = require('express');
const router = express.Router();
const {checkToken, respond} = require("../utils/mattermost");

const MM_TOKEN = process.env.FIREWALL_DUTY_MM_KEY;
const EC2_REGION = process.env.EC2_REGION;
const ACL_ID = process.env.ACL_ID;
const AUTHORIZED_USERS = (process.env.FIREWALL_AUTHORIZED_USERS || "").split(",");
const AWS_ACCESS_KEY = process.env.AWS_ACCESS_KEY;
const AWS_SECRET_ACCESS_KEY = process.env.AWS_SECRET_ACCESS_KEY;
const FIREWALL_MIN_RULE_NUMBER = process.env.FIREWALL_MIN_RULE_NUMBER || 1;
const FIREWALL_MAX_RULE_NUMBER = process.env.FIREWALL_MAX_RULE_NUMBER || 1000;
const DEBUG = process.env.DEBUG;

const config = {
    region: EC2_REGION
};
if (AWS_ACCESS_KEY && AWS_SECRET_ACCESS_KEY) {
    config.accessKeyId = AWS_ACCESS_KEY;
    config.secretAccessKey = AWS_SECRET_ACCESS_KEY;
}
AWS.config.update(config);

const ec2 = new AWS.EC2({apiVersion: '2016-11-15'});


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

        if (DEBUG) {
            console.log("FIREWALL: Incoming message: ", messageText, "from", user_name);
        }

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
                const ruleNumber = nextRuleNumber(ingressAcls);
                await addRule(ip, ruleNumber);
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
    const ruleNumber = (ingressAcls.find(acl => acl.CidrBlock === CidrBlock) || {}).RuleNumber;
    if (ruleNumber) {
        return ruleNumber;
    }
    throw `${ip} not found`;
}

function nextRuleNumber(ingressAcls) {
    const allowedAcls = ingressAcls.filter(acl => acl.RuleNumber >= FIREWALL_MIN_RULE_NUMBER && acl.RuleNumber <= FIREWALL_MAX_RULE_NUMBER);
    if (allowedAcls.length === 0) {
        return FIREWALL_MIN_RULE_NUMBER;
    }
    const lastRuleNumber = (allowedAcls.reduce((prev, next) => {
        return (prev.RuleNumber > next.RuleNumber) ? prev : next
    }) || {}).RuleNumber;
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

module.exports = router;
