const serverless = require('serverless-http');
const { app, connectDB } = require('../../app');

const handler = serverless(app);

exports.handler = async (event, context) => {
  await connectDB();
  return handler(event, context);
};
