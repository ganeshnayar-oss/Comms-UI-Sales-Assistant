# Common Siebel API Errors

This catalog captures reusable error interpretation rules for Siebel-backed UI development.

## SBL-DAT-00825

```text
Access to Resource <resource> of type <type> is denied.
```

Likely cause:

- User responsibility does not have access to the business process, business service, view, or integration object.

Fix guidance:

- Validate the authenticated user.
- Validate responsibility assignment.
- Validate workflow process or business service access.
- Do not work around this by switching to an incorrect API path.

## SBL-PRM-50027

```text
Input argument is required when invoking workflow.
```

Likely cause:

- Required workflow input is missing or misnamed.

Fix guidance:

- Check exact input argument names.
- For promotion flows, verify `ProdPromId`, `SiebelMessage`, `Account Id`, `Order Number`, and `Price List Id`.

## SBL-EAI-04381

```text
A record with identical values already exists in the Siebel database.
```

Likely cause:

- Duplicate create attempt.
- Flow recreated account/contact instead of reusing the existing record.

Fix guidance:

- Reuse the created record within the current workflow.
- Add lookup-before-create logic where appropriate.

## SBL-DAT-00498 / SBL-EAI-04389

```text
Required field is missing in instance of Integration Component.
```

Likely cause:

- PATCH or integration-object update sent partial line item data without required fields.

Fix guidance:

- Avoid patching line item integration objects unless grammar says it is safe.
- Prefer header-level operations or workflow/service APIs when changing account context.

## HTTP 404

Likely cause:

- Wrong Data API path.
- Wrong business object/component name.
- Missing or incorrectly encoded row id.
- Attempting to use a Data API shape for a service/workflow operation.

Fix guidance:

- Verify endpoint in grammar.
- Verify row id.
- Verify URL encoding.

## HTTP 405

Likely cause:

- Wrong HTTP method for the endpoint.

Fix guidance:

- Use the method specified by the grammar.
- Do not infer PATCH/POST support for Data API resources.

