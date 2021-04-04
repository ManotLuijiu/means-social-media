const { ApolloServer, PubSub } = require('apollo-server');
const { RedisCache } = require('apollo-server-cache-redis');
const mongoose = require('mongoose');
const { createLogger, format, transports } = require('winston');
const { combine, timestamp, label, printf } = format;

const resolvers = require('./graphql/resolvers');
const typeDefs = require('./graphql/typeDefs');
const { MONGODB } = require('./config');

const pubsub = new PubSub();

const PORT = process.env.PORT || 5000;

const myFormat = printf(({ level, message, label, timestamp }) => {
  return `${timestamp} [${label}] ${level}: ${message}`;
});

const logger = createLogger({
  level: 'info',
  format: combine(label({ label: 'Means Logger' }), timestamp(), myFormat),
  defaultMeta: { service: 'graphql-service' },
  transport: [
    // Write all logs with level`error` and below to `error.log`
    // Write all logs with level `info` and below to `combined.log`
    new transports.File({ filename: 'error.log', level: 'error' }),
    new transports.File({ filename: 'combined.log' }),
  ],
});

if (process.env.NODE_ENV !== 'production') {
  logger.add(
    new transports.Console({
      format: format.simple(),
    })
  );
}

const server = new ApolloServer({
  typeDefs,
  resolvers,
  cache: new RedisCache({
    host: process.env.redisServer,
  }),
  // cache: new RedisCache({
  //   sentinels: [
  //     {
  //       host: process.env.redisServer,
  //       port: process.env.redisPort,
  //     },
  //   ],
  //   password: process.env.redisPassword,
  //   name: process.env.redisName,
  //   // Options are passed through to the Redis client
  // }),
  context: ({ req }) => ({ req, pubsub }),
});

mongoose
  .connect(MONGODB, { useNewUrlParser: true, useUnifiedTopology: true })
  .then(() => {
    logger.info(`MongoDb connected.`);
    return server.listen({ port: PORT });
  })
  .then((res) => {
    logger.log({
      level: 'info',
      message: `Server is running at ${res.url}`,
    });
  })
  .catch((err) => {
    logger.log({
      level: 'info',
      message: `Mongo error ${err}`,
    });
  });
