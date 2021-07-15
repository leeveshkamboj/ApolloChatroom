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
  type Query {
    getMessages: [Message]!
  }
  type Subscription {
    messageCreated: Message
  }
  type Mutation {
    login(username: String!, password: String!): User
    register(
      email: String!
      password: String!
      confirmPassword: String!
      username: String!
    ): registerOutput
    verifyEmail(token: String!): User
    postMessage(body: String!): Message
  }
`;
