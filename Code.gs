// Global object to hold configuration parameters
var CONFIG_PARAMS = {};

// Initialize the Community Connector
var cc = DataStudioApp.createCommunityConnector();

// Configuration
function getConfig(request) {
  var config = cc.getConfig();

  config
    .newInfo()
    .setId("instructions")
    .setText("Enter your API credentials and Group ID to fetch MAPs data.");

  config
    .newTextInput()
    .setId("apiUrl")
    .setName("API URL")
    .setHelpText("Enter the base URL of your API")
    .setPlaceholder("https://poll-mgmt-api.onrender.com");

  config
    .newTextInput()
    .setId("tokenEndpoint")
    .setName("Token Endpoint")
    .setHelpText("Enter the endpoint to obtain the JWT token")
    .setPlaceholder("/auth/login");

  config
    .newTextInput()
    .setId("email")
    .setName("Email")
    .setHelpText("Enter the email for authentication")
    .setPlaceholder("admin@example.com");

  config
    .newTextInput()
    .setId("password")
    .setName("Password")
    .setHelpText("Enter the password for authentication")
    .setPlaceholder("password123");

  config
    .newTextInput()
    .setId("groupId")
    .setName("Group ID")
    .setHelpText("Enter the Telegram Group ID to fetch data for")
    .setPlaceholder("-1002322126024");

  config.setDateRangeRequired(false); // Optional, add if you want time filtering

  return config.build();
}

// Authentication (token handled internally)
function getAuthType() {
  return cc.newAuthTypeResponse().setAuthType(cc.AuthType.NONE).build();
}

function isAdminUser() {
  return true; // Return true if you want admin access, but it's not required.
}

function getData(request) {
  Logger.log("getData called by Looker Studio");
  Logger.log(
    "Requested fields from Looker Studio: " + JSON.stringify(request.fields)
  );

  CONFIG_PARAMS = request.configParams || {};

  var groupId = CONFIG_PARAMS.groupId;
  if (!groupId) {
    throw new Error("No group ID provided.");
  }

  var page = request.page || 1;
  var limit = request.limit || 50;
  var token = getToken();

  // Update the endpoint to match your API
  var url =
    CONFIG_PARAMS.apiUrl +
    "/reports/group/" +
    groupId +
    "/performance?page=" +
    page +
    "&limit=" +
    limit;
  var options = {
    headers: {
      Authorization: "Bearer " + token,
    },
    muteHttpExceptions: true,
  };

  var response = fetchWithRetry(url, options);
  if (response.getResponseCode() === 401) {
    Logger.log("Token expired, refreshing...");
    token = refreshToken();
    options.headers.Authorization = "Bearer " + token;
    response = fetchWithRetry(url, options);
  }

  if (response.getResponseCode() >= 400) {
    throw new Error(
      "Failed to fetch data: HTTP " +
        response.getResponseCode() +
        " - " +
        response.getContentText()
    );
  }

  var data;
  try {
    data = JSON.parse(response.getContentText());
    Logger.log("API response structure: " + JSON.stringify(Object.keys(data)));
    if (data.data && data.data.length > 0) {
      Logger.log("Sample category: " + JSON.stringify(data.data[0]));
      if (data.data[0].maps && data.data[0].maps.length > 0) {
        Logger.log("Sample map: " + JSON.stringify(data.data[0].maps[0]));
      }
    }
  } catch (e) {
    throw new Error(
      "Invalid JSON response: " + e.message + " - " + response.getContentText()
    );
  }

  var requestedFields = request.fields
    ? request.fields.map(function (field) {
        return field.name;
      })
    : [];
  Logger.log("Requested fields: " + JSON.stringify(requestedFields));

  var rows = transformData(data, requestedFields);
  var schema = getSchema(request).schema;

  Logger.log("Schema field count: " + schema.length);
  Logger.log(
    "First row value count: " + (rows.length > 0 ? rows[0].values.length : 0)
  );

  return {
    schema: schema.filter(function (field) {
      return requestedFields.includes(field.name);
    }),
    rows: rows,
  };
}

function transformData(data, requestedFields) {
  if (!data || !data.data) {
    throw new Error("Invalid data format: 'data' array not found.");
  }

  var fieldMap = {
    categoryName: function (item) {
      return item.categoryName || "";
    },
    categoryPerformance: function (item) {
      return item.categoryPerformance || 0;
    },
    averageValue: function (item) {
      return item.averageValue !== undefined
        ? item.averageValue
        : item.categoryPerformance || 0;
    },
    mapsNumber: function (item, mapObj) {
      return mapObj ? mapObj.mapsNumber || "Unknown" : "N/A";
    },
    percentageYes: function (item, mapObj) {
      return mapObj ? mapObj.percentageYes || 0 : null;
    },
    measurementMet: function (item, mapObj) {
      return mapObj ? mapObj.measurementMet || 0 : null;
    },
    measurementsMet: function (item) {
      return item.measurementsMet || "0/0";
    },
    measurementsMetPercentage: function (item) {
      return item.measurementsMetPercentage || 0;
    },
  };

  var rows = [];

  // Process data for each category
  data.data.forEach(function (item) {
    // If this is the "Average" summary row, create a special row
    if (item.categoryName === "Average") {
      var summaryValues = requestedFields.map(function (fieldName) {
        if (fieldName === "categoryName") return "Average";
        if (fieldName === "averageValue") return item.averageValue || 0;
        return null; // Other fields don't apply to average
      });
      rows.push({ values: summaryValues });
      return; // Skip further processing for Average
    }

    // For each MAPs item in the category, create a row
    if (item.maps && Array.isArray(item.maps) && item.maps.length > 0) {
      item.maps.forEach(function (mapObj) {
        var values = requestedFields.map(function (fieldName) {
          // Pass the specific map object to the field map function
          return fieldMap[fieldName](item, mapObj);
        });
        rows.push({ values: values });
      });
    }

    // Add a row for the category summary if needed
    if (
      requestedFields.some((field) =>
        [
          "categoryName",
          "categoryPerformance",
          "measurementsMet",
          "measurementsMetPercentage",
        ].includes(field)
      )
    ) {
      var includeCategory = true;
      var summaryValues = requestedFields.map(function (fieldName) {
        if (
          fieldName === "mapsNumber" ||
          fieldName === "percentageYes" ||
          fieldName === "measurementMet"
        ) {
          // These are map-specific fields that shouldn't be in the category summary
          includeCategory = false;
          return null;
        }
        return fieldMap[fieldName](item, null);
      });

      // Only add the category summary row if we have category-level fields
      if (includeCategory) {
        rows.push({ values: summaryValues });
      }
    }
  });

  if (rows.length === 0) {
    Logger.log("No rows generated from API response");
  } else {
    Logger.log("Generated " + rows.length + " rows");
    Logger.log(
      "Transformed first row values: " +
        JSON.stringify(rows[0]?.values || "No rows")
    );
  }

  return rows;
}

function getSchema(request) {
  var fields = DataStudioApp.createCommunityConnector().getFields();
  var types = DataStudioApp.createCommunityConnector().FieldType;

  fields
    .newDimension()
    .setId("categoryName")
    .setName("Category Name")
    .setType(types.TEXT);
  fields
    .newMetric()
    .setId("categoryPerformance")
    .setName("Category Performance")
    .setType(types.PERCENT);
  fields
    .newMetric()
    .setId("averageValue")
    .setName("Average Value")
    .setType(types.PERCENT);
  fields
    .newDimension()
    .setId("mapsNumber")
    .setName("MAPs Number")
    .setType(types.TEXT);
  fields
    .newMetric()
    .setId("percentageYes")
    .setName("Percentage Yes")
    .setType(types.PERCENT);
  fields
    .newMetric()
    .setId("measurementMet")
    .setName("Measurement Met")
    .setType(types.BOOLEAN);
  fields
    .newDimension()
    .setId("measurementsMet")
    .setName("Measurements Met")
    .setType(types.TEXT);
  fields
    .newMetric()
    .setId("measurementsMetPercentage")
    .setName("Measurements Met Percentage")
    .setType(types.PERCENT);

  return { schema: fields.build() };
}

// Token management
function getToken() {
  var token = PropertiesService.getScriptProperties().getProperty("jwtToken");
  var expiration =
    PropertiesService.getScriptProperties().getProperty("tokenExpiration");
  if (!token || new Date(expiration) < new Date()) {
    Logger.log("Token missing or expired, refreshing...");
    return refreshToken();
  }
  Logger.log("Using cached token: " + token.slice(0, 10) + "...");
  return token;
}

function refreshToken() {
  var url = CONFIG_PARAMS.apiUrl + CONFIG_PARAMS.tokenEndpoint;
  var payload = {
    email: CONFIG_PARAMS.email,
    password: CONFIG_PARAMS.password,
  };
  Logger.log(
    "Token request payload: " +
      JSON.stringify({ email: payload.email, password: "***" })
  );
  var options = {
    method: "post",
    contentType: "application/json",
    payload: JSON.stringify(payload),
    muteHttpExceptions: true,
  };

  var response = fetchWithRetry(url, options);
  var responseCode = response.getResponseCode();
  var responseText = response.getContentText();
  Logger.log("Token response code: " + responseCode);

  if (responseCode !== 200 && responseCode !== 201) {
    throw new Error(
      "Failed to authenticate - HTTP " + responseCode + ": " + responseText
    );
  }

  var data;
  try {
    data = JSON.parse(responseText);
  } catch (e) {
    throw new Error(
      "Invalid JSON response from token endpoint: " +
        e.message +
        " - " +
        responseText
    );
  }

  var token = data["access-token"];
  if (!token) {
    throw new Error(
      "Token not found in response: " + JSON.stringify(Object.keys(data))
    );
  }

  var expiration = new Date();
  expiration.setHours(expiration.getHours() + 1);
  PropertiesService.getScriptProperties().setProperty("jwtToken", token);
  PropertiesService.getScriptProperties().setProperty(
    "tokenExpiration",
    expiration.toISOString()
  );
  Logger.log("Token refreshed successfully: " + token.slice(0, 10) + "...");
  return token;
}

// Fetch with retry
function fetchWithRetry(url, options) {
  var maxAttempts = 3;
  var attempt = 0;
  while (attempt < maxAttempts) {
    try {
      return UrlFetchApp.fetch(url, options);
    } catch (e) {
      attempt++;
      Logger.log("Retry attempt " + attempt + " failed: " + e.message);
      if (attempt === maxAttempts)
        throw new Error("Max retries reached: " + e.message);
      Utilities.sleep(1000 * attempt); // Exponential backoff
    }
  }
}

// Test function
function testGetData() {
  var request = {
    configParams: {
      apiUrl: "https://poll-mgmt-api.onrender.com",
      tokenEndpoint: "/auth/login",
      email: "admin@example.com",
      password: "password123",
      groupId: "-1002322126024",
    },
    fields: [
      { name: "categoryName" },
      { name: "categoryPerformance" },
      { name: "mapsNumber" },
      { name: "percentageYes" },
      { name: "measurementMet" },
      { name: "averageValue" },
    ],
    page: 1,
    limit: 50,
  };
  var result = getData(request);
  Logger.log("Test result schema: " + JSON.stringify(result.schema));
  Logger.log("Test result row count: " + result.rows.length);
  if (result.rows.length > 0) {
    Logger.log("Sample row: " + JSON.stringify(result.rows[0]));
  }
  Logger.log("All rows: " + JSON.stringify(result.rows, null, 2)); // Pretty print all rows
}
