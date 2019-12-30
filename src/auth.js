var cc = DataStudioApp.createCommunityConnector();

// https://developers.google.com/datastudio/connector/reference#getauthtype
function getAuthType() {
  var AuthTypes = cc.AuthType;
  return cc
    .newAuthTypeResponse()
    .setAuthType(AuthTypes.NONE)
    .build();
}

/**
 * Sets the credentials.
 * @param {Request} request The set credentials request.
 * @return {object} An object with an errorCode.
 */
function setCredentials(request) {
  var domain = request.configParams.domain;
  var apikey = request.configParams.apikey;

  var validCreds = validateCredentials(domain, apikey);
  if (!validCreds) {
    // try autorize
    return {
      errorCode: "INVALID_CREDENTIALS"
    };
  }

  return {
    errorCode: "NONE"
  };
}

function validateCredentials(domain, apikey) {
  var response = UrlFetchApp.fetch(domain + "/projects.json", {
    headers: {
      "X-Redmine-API-Key": apikey,
      "Content-Type": "application/json;charset=UTF-8"
    },
    method: "get",
    muteHttpExceptions: true
  });
  return response.getResponseCode() === 200;
}
