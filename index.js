const { ApolloServer, pubsub } = require("apollo-server-express");
const mongoose = require("mongoose");
const { createServer } = require("http");
const { execute, subscribe } = require("graphql");
const { SubscriptionServer } = require("subscriptions-transport-ws");
const { makeExecutableSchema } = require("@graphql-tools/schema");
const express = require("express");

const Config = require("./config");
const typeDefs = require("./graphql/typedefs");
const resolvers = require("./graphql/resolvers");

const schema = makeExecutableSchema({
  typeDefs,
  resolvers,
});

const server = new ApolloServer({
  schema,
  context: ({ req }) => ({ req, pubsub })
});

const app = express();
const httpServer = createServer(app);

if (Config.dbUrl) {
  mongoose
    .connect(Config.dbUrl, {
      useNewUrlParser: true,
      useUnifiedTopology: true,
    })
    .then(() => {
      console.log("Database connected.");
      server
        .start({
          port: Config.port,
        })
        .then(() => {
          server.applyMiddleware({ app });
          SubscriptionServer.create(
            { schema, execute, subscribe },
            { server: httpServer, path: server.graphqlPath }
          );
          httpServer.listen(Config.port, () =>
            console.log(
              `🚀  Subscription server ready at ws://localhost:${Config.port}${server.graphqlPath}`
            )
          )
          console.log(`🚀  Server ready at http://localhost:${Config.port}${server.graphqlPath}`);
        })
        .catch((err) => {
          console.log(err);
        });
    })
    .catch((err) => {
      console.log(err);
    });
} else {
  console.log("Please enter MongoDB Url");
}
