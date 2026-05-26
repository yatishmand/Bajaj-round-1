require('dotenv').config();
const { app, connectDB } = require('./app');

// Connect to database and start server
connectDB()
  .then(() => {
    console.log('MongoDB database connected successfully!');
    const PORT = process.env.PORT || 5000;
    app.listen(PORT, () => {
      console.log(`Server is running on port ${PORT}`);
    });
  })
  .catch((err) => {
    console.error('MongoDB database connection error:', err);
    process.exit(1);
  });
