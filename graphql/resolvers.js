const {
  UserInputError,
  ApolloError,
  AuthenticationError,
} = require("apollo-server");
const jwt = require("jsonwebtoken");
const bcrypt = require("bcryptjs");
const { PubSub } = require("graphql-subscriptions");

const User = require("../models/user");
const Message = require("../models/message");
const { registerValidator, loginValidator } = require("../utils/validators");
const transport = require("../utils/mailer");
const Config = require("../config");
const checkAuth = require("../utils/check-auth");

const pubsub = new PubSub();

function generateToken(user) {
  return jwt.sign(
    {
      id: user._id,
      email: user.email,
      username: user.username,
      createdAt: new Date().toISOString(),
    },
    Config.secretKey,
    {
      expiresIn: "1h",
    }
  );
}

function generateEmailVerifyToken(id) {
  return jwt.sign(
    {
      id: id,
    },
    Config.secretKey,
    {
      expiresIn: "1h",
    }
  );
}

module.exports = {
  Query: {
    async getMessages() {
      messages = await Message.find().sort({ createdAt: 1 });
      return messages;
    },
  },

  Subscription: {
    messageCreated: {
      subscribe: () => pubsub.asyncIterator(["MESSAGE_CREATED"]),
    },
  },

  Mutation: {
    async postMessage(_, { body }, context) {
      if (body.trim() === "") {
        throw new UserInputError("Empty message body.");
      }
      const user = checkAuth(context);
      message = new Message({
        username: user.username,
        body,
        createdAt: new Date().toISOString(),
      });
      r = await message.save();
      pubsub.publish("MESSAGE_CREATED", {
        messageCreated: {
          id: r._id,
          username: r.username,
          body: r.body,
          createdAt: r.createdAt,
        },
      });
      return {
        id: r._id,
        username: r.username,
        body: r.body,
        createdAt: r.createdAt,
      };
    },

    async login(_, { username, password }) {
      username = username.toLowerCase();
      const { valid, errors } = loginValidator(username, password);
      if (!valid) {
        throw new UserInputError("Errors", {
          errors,
        });
      }
      const user = await User.findOne({
        username,
      });
      if (!user) {
        throw new UserInputError("User not found", {
          errors: {
            username: "User not found.",
          },
        });
      }
      const match = await bcrypt.compare(password, user.password);
      if (!match) {
        errors.password = "Invalid credentials";
        throw new UserInputError("Invalid credentials.", {
          errors,
        });
      }
      if (!user.verified) {
        errors.email = "Email not verified";
        throw new UserInputError("Email not verified.", {
          errors,
        });
      }

      const token = generateToken(user);
      return {
        id: user._id,
        token,
        username: user.username,
        email: user.email,
        createdAt: user.createdAt,
      };
    },
    async register(_, { email, password, confirmPassword, username }) {
      username = username.toLowerCase();
      const { valid, errors } = registerValidator(
        username,
        email,
        password,
        confirmPassword
      );
      if (!valid) {
        throw new UserInputError("Errors", {
          errors,
        });
      }
      if (
        await User.findOne({
          email,
        })
      ) {
        throw new UserInputError("Email already registered", {
          errors: {
            email: "Email already registered",
          },
        });
      }
      if (
        await User.findOne({
          username,
        })
      ) {
        throw new UserInputError("Username is taken", {
          errors: {
            username: "This username is taken",
          },
        });
      }
      password = await bcrypt.hash(password, 12);

      user = new User({
        username,
        email,
        password,
        createdAt: new Date().toISOString(),
      });
      const link = Config.verify_address + generateEmailVerifyToken(user._id);

      const message = {
        from: Config.smpt_email,
        to: email,
        subject: "Verify your email address",
        html: `Hey ${username}, confirm your email by click <a href="${link}">here</a>`,
      };
      transport.sendMail(message, (err, info) => {
        if (err) {
          console.log(err);
          throw new ApolloError("Internal Server Error", {
            errors: {
              email: `Error in sending mail to ${email}`,
            },
          });
        }
      });
      const result = await user.save();
      return {
        email: result.email,
      };
    },
    async verifyEmail(_, { token }) {
      if (token) {
        try {
          const { id } = jwt.verify(token, Config.secretKey);
          var user = await User.findById(id);
          if (!user) {
            throw new AuthenticationError("Invalid/Expired token");
          } else if (user.verified) {
            throw new AuthenticationError("Email already verified");
          }
          await User.findById(id).updateOne({
            verified: true,
          });
          return {
            id: user._id,
            token: generateToken(user),
            username: user.username,
            email: user.email,
            createdAt: user.createdAt,
          };
        } catch (err) {
          throw new AuthenticationError("Invalid/Expired token");
        }
      } else {
        throw new AuthenticationError("No token provided");
      }
    },
  },
};
