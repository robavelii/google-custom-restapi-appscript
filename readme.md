# Google Data Studio Community Connector

## Overview

This project is a **Google Data Studio (Looker Studio) Community Connector** built using **Google Apps Script**. It enables users to fetch and visualize data from an external API in **Google Data Studio**. The connector handles authentication via **JWT** and transforms API responses into a suitable format for visualization.

## Features

- **Custom API Integration**: Fetch data from an external API.
- **JWT Authentication**: Authenticate API requests using JSON Web Tokens.
- **Dynamic Schema Definition**: Adaptable schema structure for Looker Studio.
- **Data Transformation**: Process and format data before visualization.
- **User Configuration**: Allow users to input API keys and parameters via a UI.

---

## Setup & Installation

### Prerequisites

- A **Google Account** to use **Google Apps Script** and **Looker Studio**.
- **Access to the external API** (ensure you have the necessary API credentials).
- Basic familiarity with Google Apps Script and Looker Studio connectors.

### Steps to Deploy

1. **Open Google Apps Script**:

   - Go to [Google Apps Script](https://script.google.com/) and create a new project.
   - Copy and paste the provided script into the editor.

2. **Enable Required Services**:

   - In the Apps Script Editor, go to `Services > Add a service`.
   - Add `Data Studio API` and `URL Fetch Service`.

3. **Set Up Authentication**:

   - Update the `getConfig()` function to accept API credentials.
   - Modify the `getToken()` function to generate a valid JWT token.

4. **Deploy as a Community Connector**:

   - Click `Deploy` > `New Deployment`.
   - Select `Google Data Studio Connector`.
   - Set the access permissions to `Anyone`.
   - Copy the deployment URL for later use.

5. **Use in Google Data Studio**:
   - Open [Looker Studio](https://datastudio.google.com/).
   - Click `Create` > `Data Source`.
   - Select `Community Connectors` > `Enter Deployment URL`.
   - Authenticate and configure the connector.
   - Connect and visualize your data.

---

## Running & Testing

### Local Testing

Since Google Apps Script runs in the cloud, local testing isn't straightforward. However, you can:

- Use `Logger.log()` to debug API responses.
- Deploy in `Test Mode` before publishing.

### Debugging Steps

1. **Check API Authentication**:

   - Open `Execution Log` in Apps Script.
   - Log `response` from API calls.

2. **Verify Schema & Data Format**:

   - Use `console.log` in Looker Studio’s Debug Mode.

3. **Inspect API Calls**:
   - Use `fetch()` in Apps Script to manually call the API and inspect responses.

---

## Contributions

Feel free to fork and improve this connector! Submit issues or PRs for improvements.

## License

MIT License
