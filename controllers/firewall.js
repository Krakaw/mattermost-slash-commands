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
const FIREWALL_MAX_RULE_COUNT = process.env.FIREWALL_MAX_RULE_COUNT || 1000;

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

        if (messageText !== "") {
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
    if (RuleNumber >= FIREWALL_MAX_RULE_COUNT) {
        throw `Invalid RuleNumber: ${RuleNumber} (Cannot be < 1 or > ${FIREWALL_MAX_RULE_COUNT - 1})`;
    }
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
    if (!RuleNumber || RuleNumber >= FIREWALL_MAX_RULE_COUNT) {
        throw `Invalid RuleNumber: ${RuleNumber} (Cannot be < 1 or > ${FIREWALL_MAX_RULE_COUNT - 1})`;
    }

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
    const lastRuleNumber = (ingressAcls.filter(acl => acl.RuleNumber < FIREWALL_MAX_RULE_COUNT).slice(-1).pop() || {}).RuleNumber || 0;
    return lastRuleNumber + 1;
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
