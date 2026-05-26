const mongoose = require('mongoose');

const priorityTargets = {
  urgent: 60,     // 1 hour
  high: 240,      // 4 hours
  medium: 1440,   // 24 hours
  low: 4320       // 72 hours
};

const ticketSchema = new mongoose.Schema({
  subject: {
    type: String,
    required: [true, 'Subject is required'],
    trim: true
  },
  description: {
    type: String,
    required: [true, 'Description is required'],
    trim: true
  },
  customerEmail: {
    type: String,
    required: [true, 'Customer email is required'],
    trim: true,
    lowercase: true,
    match: [/^\w+([.-]?\w+)*@\w+([.-]?\w+)*(\.\w{2,3})+$/, 'Please provide a valid email address']
  },
  priority: {
    type: String,
    required: [true, 'Priority is required'],
    enum: {
      values: ['low', 'medium', 'high', 'urgent'],
      message: 'Priority must be one of: low, medium, high, urgent'
    }
  },
  status: {
    type: String,
    enum: {
      values: ['open', 'in_progress', 'resolved', 'closed'],
      message: 'Status must be one of: open, in_progress, resolved, closed'
    },
    default: 'open'
  },
  resolvedAt: {
    type: Date,
    default: null
  }
}, {
  timestamps: { createdAt: true, updatedAt: false },
  toJSON: { virtuals: true },
  toObject: { virtuals: true }
});

// Compute ageMinutes virtual field
ticketSchema.virtual('ageMinutes').get(function() {
  const endDate = this.resolvedAt ? new Date(this.resolvedAt) : new Date();
  const diffMs = endDate.getTime() - this.createdAt.getTime();
  return Math.max(0, Math.floor(diffMs / 60000));
});

// Compute slaBreached virtual field
ticketSchema.virtual('slaBreached').get(function() {
  const targetLimit = priorityTargets[this.priority] || 4320;
  return this.ageMinutes > targetLimit;
});

module.exports = mongoose.model('Ticket', ticketSchema);
