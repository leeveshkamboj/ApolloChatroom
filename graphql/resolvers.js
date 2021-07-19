const {
  UserInputError,
  ApolloError,
  AuthenticationError,
} = require("apollo-server");
const jwt = require("jsonwebtoken");
const bcrypt = require("bcrypt");
const { PubSub, withFilter } = require("graphql-subscriptions");

const User = require("../models/user");
const Message = require("../models/message");
const Contact = require("../models/contacts");
const Pm = require("../models/pm");
const { registerValidator, loginValidator } = require("../utils/validators");
const transport = require("../utils/mailer");
const Config = require("../config");
const checkAuth = require("../utils/check-auth");
const { secretKey } = require("../config");

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

async function updateContact(
  selfUsername,
  newContact,
  lastMessageUsername,
  lastMessage,
  lastMessageAt,
  lastMessageSeen
) {
  const newContactObj = {
    username: newContact,
    lastMessageUsername,
    lastMessage,
    lastMessageAt,
    lastMessageSeen,
  };
  contact = await Contact.findOne({
    username: selfUsername,
  });
  if (!contact) {
    contact = new Contact({
      username: selfUsername,
      contacts: [newContactObj],
    });
    await contact.save();
  } else {
    await contact.updateOne({
      username: selfUsername,
      contacts: [
        ...contact.contacts.filter((contact) => {
          return contact.username != newContact;
        }),
        newContactObj,
      ],
    });
  }
}

function compare(a, b) {
  if (a.lastMessageAt > b.lastMessageAt) {
    return -1;
  }
  if (a.lastMessageAt < b.lastMessageAt) {
    return 1;
  }
  return 0;
}

module.exports = {
  Query: {
    async getMessages() {
      messages = await Message.find().sort({ createdAt: 1 });
      return messages;
    },
    async getContacts(_, __, context) {
      const user = checkAuth(context);
      contact = await Contact.findOne({
        username: user.username,
      });
      var unread = 0;
      if (!contact) {
        return { contacts: [], unread };
      } else {
        Object.values(contact.contacts).map((con) => {
          if (
            con.lastMessageUsername !== user.username &&
            !con.lastMessageSeen
          ) {
            unread += 1;
          }
        });
        return { contacts: contact.contacts.sort(compare), unread };
      }
    },
    async getPms(_, { username }, context) {
      const user = checkAuth(context);
      if (!user) {
        throw new UserInputError("Invalid token");
      }
      if (user.username == username) {
        throw new UserInputError("Can't get message.", {
          errors: {
            username: "Can't set messages.",
          },
        });
      }
      if (
        !(await User.findOne({
          username,
        }))
      ) {
        throw new UserInputError("Username is not found", {
          errors: {
            username: "There is no user by this username",
          },
        });
      }
      const users = [username, user.username].sort();
      conv = await Pm.findOne({
        users,
      }).sort({ createdAt: 1 });
      if (!conv) {
        return [];
      }

      Object.values(conv.messages).map(function (msg) {
        if (msg.username !== user.username) {
          return (msg.seen = true);
        }
      });
      const lastMsg = conv.messages[conv.messages.length - 1];
      if (lastMsg.username !== user.username) {
        pubsub.publish(`MESSAGE_SEEN`, {
          pmSeenSub: lastMsg.id,
        });
      }
      await conv.updateOne({ messages: conv.messages });
      await updateContact(
        user.username,
        username,
        lastMsg.username,
        lastMsg.body,
        lastMsg.createdAt,
        lastMsg.username !== user.username
      );
      return conv.messages;
    },
  },

  Subscription: {
    messageCreated: {
      subscribe: () => pubsub.asyncIterator(["MESSAGE_CREATED"]),
    },
    pmCreated: {
      subscribe: withFilter(
        () => pubsub.asyncIterator("PM_CREATED"),
        async (payload, variables) => {
          const user = jwt.verify(variables.token, secretKey);
          if (
            payload.toUsername === user.username &&
            variables.username === payload.pmCreated.username
          ) {
            const users = [
              payload.toUsername,
              payload.pmCreated.username,
            ].sort();
            a = await Pm.findOne({ users });
            await a.updateOne({
              users,
              messages: [
                ...a.messages.filter((msg) => {
                  return msg.id !== payload.pmCreated.id;
                }),
                {
                  id: payload.pmCreated.id,
                  username: payload.pmCreated.username,
                  body: payload.pmCreated.body,
                  createdAt: payload.pmCreated.createdAt,
                  seen: true,
                },
              ],
            });
            updateContact(
              payload.toUsername,
              variables.username,
              payload.pmCreated.username,
              payload.pmCreated.body,
              payload.pmCreated.createdAt,
              true
            )
          }
          if (
            payload.toUsername === user.username &&
            variables.username === payload.pmCreated.username
          ) {
            pubsub.publish(`MESSAGE_SEEN`, {
              pmSeenSub: payload.pmCreated.id,
            });
          }
          return (
            (payload.toUsername === user.username &&
              variables.username === payload.pmCreated.username) ||
            payload.pmCreated.username === user.username
          );
        }
      ),
    },
    pmSeenSub: {
      subscribe: () => pubsub.asyncIterator(["MESSAGE_SEEN"]),
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

    async postPm(_, { username, body }, context) {
      const user = checkAuth(context);
      if (!user) {
        throw new UserInputError("Invalid token");
      }
      if (user.username == username) {
        throw new UserInputError("Can't send message to self.", {
          errors: {
            username: "Can't send message to self.",
          },
        });
      }
      if (
        !(await User.findOne({
          username,
        }))
      ) {
        throw new UserInputError("Username is not found", {
          errors: {
            username: "There is no user by this username",
          },
        });
      }
      if (body.trim() === "") {
        throw new UserInputError("Empty message body.", {
          errors: {
            body: "Message can't be empty.",
          },
        });
      }
      const date = new Date().toISOString();

      const users = [username, user.username].sort();
      conv = await Pm.findOne({
        users,
      });
      if (!conv) {
        pm = new Pm({
          users,
          messages: [],
        });
        conv = await pm.save();
      }

      pmPosted = await conv.updateOne({
        messages: [
          ...conv.messages,
          {
            username: user.username,
            body: body,
            createdAt: date,
            seen: false,
          },
        ],
      });
      conv = await Pm.findOne({
        users,
      });
      const sendPm = {
        id: conv.messages[conv.messages.length - 1].id,
        username: user.username,
        body: body,
        createdAt: date,
        seen: false,
      };

      pubsub.publish(`PM_CREATED`, {
        pmCreated: sendPm,
        toUsername: username,
      });

      await updateContact(
        user.username,
        username,
        user.username,
        body,
        date,
        false
      );
      await updateContact(
        username,
        user.username,
        user.username,
        body,
        date,
        false
      );

      return sendPm;
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
    async search(_, { username }, context) {
      const check = checkAuth(context);
      if (!check) {
        throw new UserInputError("Action denied!");
      } else if (username.trim() === "") {
        throw new UserInputError("Username can't be empty.", {
          errors: {
            username: "Username can't be empty.",
          },
        });
      } else if (check.username === username) {
        throw new UserInputError("Can't chat with yourself.", {
          errors: {
            username: "Can't chat with yourself.",
          },
        });
      }

      username = username.toLowerCase();
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
      return true;
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
