# Service Requests Domain Grammar

The Service Requests domain covers service request create, query, update, notes, and assignment.

## Operations

### Create Service Request

Business intent: Create a new service request for the customer.

Preferred API type: Data API or Service API.

Sequencing rules:

- Associate service request to account id.
- Associate contact id when available.
- Capture summary, type, severity, and status.

### Retrieve Service Request List

Business intent: Show customer service requests.

Preferred API type: Data API.

Sequencing rules:

- Query by account id.
- Support status filters such as Open and Closed.

### Retrieve Service Request Details

Business intent: Open a selected service request.

Preferred API type: Data API.

Sequencing rules:

- Query by service request id.
- Include notes/activities if supported by configured endpoint.

### Update Service Request Status

Business intent: Change the status of a service request.

Preferred API type: Data API or Service API.

Sequencing rules:

- Validate allowed status transitions.
- Do not overwrite unrelated fields.

### Add Note Or Activity To Service Request

Business intent: Add a note or activity to a service request.

Preferred API type: Data API or Service API.

Sequencing rules:

- Truncate text fields to Siebel field length limits.
- Associate note/activity to the service request id.

