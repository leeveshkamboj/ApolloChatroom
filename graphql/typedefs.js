const { gql } = require("apollo-server");

module.exports = gql`
  type User {
    id: ID!
    email: String!
    token: String!
    username: String!
    createdAt: String!
  }
  type registerOutput {
    email: String!
  }
  type Message {
    id: ID!
    username: String!
    body: String!
    createdAt: String!
  }
  type Contact {
    username: String
    lastMessageUsername: String
    lastMessage: String
    lastMessageAt: String
    lastMessageSeen: Boolean
  }
  type contactsOutput {
    contacts: [Contact]!
    unread: Int!
  }
  type Pm {
    id: ID
    username: String
    body: String
    createdAt: String
    seen: Boolean
  }
  type Query {
    getMessages: [Message]!
    getContacts: contactsOutput
    getPms(username: String!): [Pm]!
  }
  type Subscription {
    messageCreated: Message
    pmCreated(token: String!, username: String!): Pm
    pmSeenSub: ID!
  }
  type Mutation {
    login(username: String!, password: String!): User
    register(
      email: String!
      password: String!
      confirmPassword: String!
      username: String!
    ): registerOutput
    search(username: String!): String!
    verifyEmail(token: String!): User
    postMessage(body: String!): Message
    postPm(username: String!, body: String!): Pm
  }
`;
