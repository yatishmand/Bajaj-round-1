const express = require('express');
const mongoose = require('mongoose');
const cors = require('cors');

const app = express();

// Middlewares
app.use(cors());
app.use(express.json());

// Mount Routes
const ticketRoutes = require('./routes/ticketRoutes');
app.use('/tickets', ticketRoutes);

// Root path diagnostic route
app.get('/', (req, res) => {
  res.json({
    message: "Welcome to the DeskFlow API",
    studentInfo: {
      name: "Yatish Mandowara",
      email: "yatishmandowara231012@acropolis.in",
      rollNo: "0827CI231155"
    }
  });
});

// Global 404 Route
app.use((req, res) => {
  res.status(404).json({ error: 'Route not found' });
});

// Cached database connection for serverless environments
const connectDB = async () => {
  if (mongoose.connection.readyState === 1) return;
  const mongoURI = process.env.MONGO_URI || 'mongodb://localhost:27017/deskflow';
  await mongoose.connect(mongoURI);
  console.log('MongoDB connected');
};

module.exports = { app, connectDB };
