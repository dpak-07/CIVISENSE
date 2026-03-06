# CiviSense Seeded Credentials (Development)

These credentials are seeded from:

- `database/main_admin.json`
- `database/municipal_users.json`

Use these only for local/dev testing.

## Main Admin

- Email: `mainadmin@gmail.com`
- Password: `1234`
- Role: `super_admin`

## Municipal / Officer Accounts

- Password for seeded officer accounts: `1234`
- Role: `officer`
- Email/login value is taken from `database/municipal_users.json` `email` field.
- All seeded municipal emails are now normalized to `@gmail.com` format.

### Example: Puzhal Office

Current seeded record in `municipal_users.json` uses:

- Name: `Puzhal Sub Office Officer`
- Email/Login: `puzhalsuboffice@gmail.com`
- Password: `1234`
- Mapped municipal office name: `Puzhal Sub Office`

Additional seeded alias currently present:

- Name: `Puhal Sub Office Officer`
- Email/Login: `puhalsuboffice@gmail.com`
- Password: `1234`
- Mapped municipal office name: `Puzhal Sub Office`
