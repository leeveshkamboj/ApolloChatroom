# Apollo Chatroom Server

Chatroom Server made using Apollo, Graphql and Mongodb.


# Deploy on local

1. Install Dependencies
`npm install`

2. Add .env file in the root directory like this:-
```
DB_URL=Your Mongodb Connection Url
SECRET_KEY=Secret key to generate JSON Web Token
SMTP_HOST=Host of SMTP
SMTP_PORT=Port of SMTP
SMTP_USER=Username of SMTP
SMTP_PASS=Password of SMTP
VERIFY_ADDRESS=Address for email verification eg. https://{url-of-your-frontend}/verify/
```

3. Start Sever
`npm start`