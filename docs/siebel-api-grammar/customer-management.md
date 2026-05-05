# Customer Management Domain Grammar

The Customer Management domain covers contacts, accounts, account-contact association, and customer address handling.

## Operations

### Create Contact

Business intent: Create a Siebel contact from the first-page natural-language intake or agent action.

Preferred API type: Data API or Service API, depending on deployment grammar.

Sequencing rules:

- Parse customer name and address before create.
- Store returned contact id.
- Reuse the contact id during account creation and order association.

### Create Residential Account

Business intent: Create a customer account for a residential customer.

Preferred API type: Service API.

Endpoint:

```text
POST /siebel/v1.0/service/SWI Customer Party Service/Insert
```

Sequencing rules:

- Create or identify contact first.
- Set account type to Residential unless customer-specific grammar says otherwise.
- Set primary contact to the created contact.
- Set price list id when required by account service.
- Reuse the created account for the rest of the workflow.

### Update Account

Business intent: Update editable account fields such as name, type, phone, email, account site, status, or profile attributes after the account already exists.

Preferred API type: Data API for simple account field updates. Use Service API instead when the update must maintain related objects, trigger account lifecycle logic, or update address/contact/billing profile relationships.

Endpoint:

```text
PATCH /siebel/v1.0/data/Account/Account/{{accountId}}
```

Sequencing rules:

- Requires account id.
- Send only the fields being changed.
- Use service-specific operations for address, contact relationship, billing profile, or account lifecycle changes.
- Do not recreate the account to correct account details.
- Re-query the account after update when UI or downstream order logic depends on the changed fields.

### Associate Contact To Account

Business intent: Make the created contact the primary contact for the account.

Preferred API type: Service API.

Sequencing rules:

- Requires account id and contact id.
- Do not create duplicate contact/account records if they already exist in workflow state.

### Associate Address To Account

Business intent: Use contact address as account address.

Preferred API type: Service API.

Sequencing rules:

- Normalize address from intake.
- Associate the address with the account after account creation.
- Do not store address only in local UI state.

### Create And Associate Billing Profile

Business intent: Create billing profile information for the account when required by order or billing flows.

Preferred API type: Service API.

Sequencing rules:

- Requires account id.
- Requires billing address or billing account context.
- Run only when workflow reaches billing setup.
- Do not create duplicate billing profiles for repeated cart actions.

### Retrieve Account Profile

Business intent: Pull customer profile for Customer 360 and workflow context.

Preferred API type: Data API.

Sequencing rules:

- Query by account id when available.
- Limit results to one account for a specific workflow context.
