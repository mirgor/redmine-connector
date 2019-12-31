var cc = DataStudioApp.createCommunityConnector();

var regexForYMDH = /^(\d\d)T(\d\d):/;

// https://developers.google.com/datastudio/connector/reference#isadminuser
function isAdminUser() {
  return false;
}

// https://developers.google.com/datastudio/connector/reference#getconfig
function getConfig(request) {
  var config = cc.getConfig();

  config
    .newTextInput()
    .setId("domain")
    .setName("Redmine site URL")
    .setHelpText(
      "Enter the URL of your redmine site as https://your-redmine.com"
    )
    .setPlaceholder("https://your-redmine.com");

  config
    .newTextInput()
    .setId("apikey")
    .setName("API access key")
    .setHelpText("Enter the your API access key")
    .setPlaceholder("");

  config
    .newTextInput()
    .setId("project_id")
    .setName("ID project ")
    .setHelpText("Enter project ID")
    .setPlaceholder("");

  return config.build();
}

function getFields() {
  var fields = cc.getFields();
  var types = cc.FieldType;
  var aggregations = cc.AggregationType;

  fields
    .newDimension()
    .setId("id")
    .setName("Id Issue")
    .setType(types.TEXT)
    .setDescription(
        "ID issue"
    );
  fields
    .newDimension()
    .setId("tracker")
    .setName("Tracker")
    .setType(types.TEXT)
    .setDescription(
        "Tracker name"
    );
  fields
    .newDimension()
    .setId("status")
    .setName("Status")
    .setType(types.TEXT);
  fields
    .newDimension()
    .setId("priority")
    .setName("Priority")
    .setType(types.TEXT);
  fields
    .newDimension()
    .setId("author")
    .setName("Author")
    .setType(types.TEXT);
  fields
    .newDimension()
    .setId("assigned_to")
    .setName("Assigned To")
    .setType(types.TEXT);
  fields
    .newMetric()
    .setId("done_ratio")
    .setName("Done Ratio")
    .setType(types.NUMBER)
    .setAggregation(aggregations.AVG);
  fields
    .newMetric()
    .setId("start_date")
    .setName("Start Date")
    .setType(types.YEAR_MONTH_DAY);
  fields
    .newMetric()
    .setId("due_date")
    .setName("Due Date")
    .setType(types.YEAR_MONTH_DAY);
  fields
    .newMetric()
    .setId("created_on")
    .setName("Created On")
    .setType(types.YEAR_MONTH_DAY_HOUR);
  fields
    .newMetric()
    .setId("updated_on")
    .setName("Updated On")
    .setType(types.YEAR_MONTH_DAY_HOUR);

  return fields;
}

// https://developers.google.com/datastudio/connector/reference#getschema
function getSchema(request) {
  return { schema: getFields().build() };
}

function responseToRows(requestedFields, responseData){
  return responseData.map(function(item) {
    var values = [];
    requestedFields.asArray().forEach(function(field) {
      switch (field.getId()) {
        case "id":
          values.push(item.id.toString());
          break;
        case "tracker":
          values.push(item.tracker.name.toString());
          break;
        case "status":
          values.push(item.status ? item.status.name.toString() : "undefined");
          break;
        case "priority":
          values.push(item.priority ? item.priority.name.toString() : "undefined");
          break;
        case "author":
          values.push(item.author ? item.author.name.toString() : "undefined");
          break;
        case "assigned_to":
          values.push(item.assigned_to ? item.assigned_to.name.toString() : "undefined");
          break;
        case "done_ratio":
          values.push(item.done_ratio ? item.done_ratio : 0);
          break;
        case "start_date":
          var start_date = strDateToYMD(
              item.start_date
          );
          values.push(start_date);
          break;
        case "due_date":
          var due_date = strDateToYMD(
              item.due_date
          );
          values.push(due_date);
          break;
        case "created_on":
          var created_on = strDateToYMDH(
              item.created_on
          );
          values.push(created_on);
          break;
        case "updated_on":
          var updated_on = strDateToYMDH(
              item.updated_on
          );
          values.push(updated_on);
          break;
        default:
          values.push("");
      }
    });
    return { values: values };
  });
}

// https://developers.google.com/datastudio/connector/reference#getdata
function getData(request) {
  var domain = request.configParams.domain;
  var apikey = request.configParams.apikey;
  var projectId = request.configParams.project_id;
  if (!projectId) {
    projectId = 0;
  }

  var validCreds = validateCredentials(domain, apikey);
  if (!validCreds) {
    return {
      errorCode: "INVALID_CREDENTIALS"
    };
  }

  var requestedFields = getFields().forIds(
      request.fields.map(function(field) {
        return field.name;
      })
  );

  //Collaborator pager: {"total_count": 56, "offset": 0, "limit": 25}
  var pager = {
    total_count: 100,
    offset: 0,
    limit: 100
  };
  var data_response = [];

  for (var i = 1; (i-1) * pager.limit <= pager.total_count && i < 10; i++) {
    var url = domain + "/projects/" + projectId + "/issues.json?limit=" + pager.limit + "&page=" + i ;
    var r_data_response = _getResByAPI(url, apikey);
    data_response = data_response.concat(r_data_response.issues);
    if (r_data_response.total_count) {
      pager.total_count = r_data_response.total_count;
    }
  }

  var rows = responseToRows(requestedFields, data_response);

  return {
    schema: requestedFields.build(),
    rows: rows
  };
}


function _getResByAPI(url, apikey) {
  var response = UrlFetchApp.fetch(url, {
    headers: {
      "X-Redmine-API-Key": apikey,
      "Content-Type": "application/json;charset=UTF-8"
    },
    method: "get",
    muteHttpExceptions: true
  });

  var responseCode = response.getResponseCode();
  var res;

  switch (responseCode) {
    case 200:
      res = JSON.parse(response.getContentText());
      break;
    default:
      res = "Error " + responseCode;
      _myLog(
          "Error: " +
          response.getResponseCode() +
          "\n\n" +
          response.getContentText()
      );
      break;
  }
  return res;
}


/**
 * "2019-12-16" -> 20191109
 **/
function strDateToYMD(strDate) {
  if (strDate) {
    var dateParts = strDate.split("-");
    if (dateParts[0] && dateParts[1] && dateParts[2]) {
      return dateParts[0] + dateParts[1] + dateParts[2];
    }
  }
  return "";
}

/**
 * "2019-12-06T07:36:57Z" -> 2019110907
 *
 **/
function strDateToYMDH(strDate) {
  if (strDate) {
    var dateParts = strDate.split("-");
    if (dateParts[0] && dateParts[1] && dateParts[2]) {
      var hours = regexForYMDH.exec(dateParts[2])
          ? regexForYMDH.exec(dateParts[2])[2]
          : "00";
      dateParts[2] = regexForYMDH.exec(dateParts[2])[1];
      return dateParts[0] + dateParts[1] + dateParts[2] + hours;
    }
  }
  return "";
}


function _myLog(log) {
  if (!log){
    log = "none";
  }
  if (typeof log == "object") {
    log = JSON.stringify(log);
  }
  var message = log.toString() || "-";
  var ss = SpreadsheetApp.openById(
      "1QWGp6aBBtJVWxCsA0yoAM_qPNhwtPwVYV1wgzwR1cgM"
  );
  var sheet = ss.getSheets()[0];
  var curDate = Utilities.formatDate(
      new Date(),
      "GMT+3",
      "yyyy-MM-dd HH:mm:ss"
  );
  sheet.appendRow([curDate, "rmc :: " +  message]);
}
