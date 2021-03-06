'use strict';

/**
 *--------------------------------------------------------------------------
 * Learnosity SDK - Init
 *--------------------------------------------------------------------------
 *
 * Used to generate the necessary security and request data (in the
 * correct format) to integrate with any of the Learnosity API services.
 *
 */

var _ = require('underscore');
var sha256 = require('crypto-js/sha256');
var moment = require('moment');

/**
 *
 *
 * @param requestPacket
 * @returns string
 */
function convertRequestPacketToString(requestPacket) {
    if (requestPacket && typeof requestPacket !== 'string') {
        return JSON.stringify(requestPacket);
    } else {
        return requestPacket;
    }
}

/**
 * The API for calling assess mixes the security and request parameters.
 * This function splits them back out.
 *
 * @param requestPacket    requestPacket is mutated as a result.
 * @param securityPacket
 * @param secret
 */
function extractQuestionsApiActivity(requestPacket, securityPacket, secret) {
    if (requestPacket.questionsApiActivity) {
        var questionsApi = requestPacket.questionsApiActivity;
        var domain = 'assess.learnosity.com';
        if (securityPacket.domain) {
            domain = securityPacket.domain;
        } else if (questionsApi.domain) {
            domain = questionsApi.domain;
        }

        requestPacket.questionsApiActivity = {
            'consumer_key': securityPacket.consumer_key,
            'timestamp': securityPacket.timestamp,
            'user_id': securityPacket.user_id,
            'signature': hashSignatureArray([
                securityPacket.consumer_key,
                domain,
                securityPacket.timestamp,
                securityPacket.user_id,
                secret
            ])
        };

        delete questionsApi.consumer_key;
        delete questionsApi.domain;
        delete questionsApi.timestamp;
        delete questionsApi.user_id;
        delete questionsApi.signature;

        requestPacket.questionsApiActivity =
            requestPacket.questionsApiActivity.concat(questionsApi);
    }
}

/**
 * Creates the signature hash.
 *
 * @param service        string
 * @param securityPacket object
 * @param secret         string
 * @param requestString  string
 * @param action         object
 */
function generateSignature(
    service,
    securityPacket,
    secret,
    requestString,
    action
) {
    var signatureArray = [
        securityPacket.consumer_key,
        securityPacket.domain,
        securityPacket.timestamp
    ];
    if(securityPacket.user_id) {
        signatureArray.push(securityPacket.user_id);
    }
    signatureArray.push(secret);

    // Add the requestPacket if necessary
    var signRequestData = !(service === 'assess' || service === 'questions');
    if (signRequestData && requestString && requestString.length > 0) {
        signatureArray.push(requestString);
    }

    // Add the action if necessary
    if (action && action.length > 0) {
        signatureArray.push(action);
    }

    return hashSignatureArray(signatureArray);
}

/**
 * Joins an array (with '_') and hashes it.
 *
 * @param signatureArray array
 * @returns string
 */
function hashSignatureArray(signatureArray) {
    return sha256(signatureArray.join('_')).toString();
}

/**
 * @constructor
 */
function LearnositySDK() {}

/**
 * @see https://docs.learnosity.com/ For more information
 *
 * @param service        string
 * @param securityPacket object
 * @param secret         string
 * @param requestPacket  object
 * @param action         object
 *
 * @returns object The init options for a Learnosity API
 */
LearnositySDK.init = function (
    service,
    securityPacket,
    secret,
    requestPacket,
    action
) {
    // requestPacket can be passed in as an object or as an already encoded
    // string.
    var requestString = convertRequestPacketToString(requestPacket);

    // Automatically timestamp the security packet
    if (!securityPacket.timestamp) {
        securityPacket.timestamp = moment().utc().format('YYYYMMDD-HHmm');
    }

    if (service === 'assess') {
        extractQuestionsApiActivity(requestPacket, securityPacket, secret);
    }

    // Automatically populate the user_id of the security packet.
    if (_.contains(['author', 'data', 'items', 'reports'], service)) {
        // The Events API requires a user_id, so we make sure it's a part
        // of the security packet as we share the signature in some cases
        if (!securityPacket.user_id && requestPacket && requestPacket.user_id) {
            securityPacket.user_id = requestPacket.user_id;
        }
    }

    // Generate the signature based on the arguments provided
    securityPacket.signature = generateSignature(
        service,
        securityPacket,
        secret,
        requestString,
        action
    );

    var output;
    if(service === 'data') {
         output = {
            'security': JSON.stringify(securityPacket),
            'request': JSON.stringify(requestPacket),
            'action': action
        };
    } else if (service === 'questions') {
        output = _.extend(securityPacket, requestPacket);
    } else {
        output = {
            'security': securityPacket,
            'request': requestPacket
        };
    }

    return output;
};

module.exports = LearnositySDK;
