const express = require('express');
const router = express.Router();
const Ticket = require('../models/Ticket');

const STATUS_ORDER = ['open', 'in_progress', 'resolved', 'closed'];

// Helper to validate status transitions
const isValidTransition = (currentStatus, newStatus) => {
  if (currentStatus === newStatus) return true;
  
  const currentIdx = STATUS_ORDER.indexOf(currentStatus);
  const newIdx = STATUS_ORDER.indexOf(newStatus);
  
  if (currentIdx === -1 || newIdx === -1) return false;
  
  // Forward transition must be exactly 1 step
  if (newIdx > currentIdx) {
    return newIdx === currentIdx + 1;
  }
  
  // Backward transition must be exactly 1 step
  if (newIdx < currentIdx) {
    return newIdx === currentIdx - 1;
  }
  
  return false;
};

// @route   POST /tickets
// @desc    Create a ticket
router.post('/', async (req, res) => {
  try {
    const { subject, description, customerEmail, priority } = req.body;
    
    // Create new ticket
    const ticket = new Ticket({
      subject,
      description,
      customerEmail,
      priority
    });

    await ticket.save();
    res.status(201).json(ticket);
  } catch (error) {
    if (error.name === 'ValidationError') {
      const messages = Object.values(error.errors).map(val => val.message);
      return res.status(400).json({ error: messages.join(', ') });
    }
    res.status(500).json({ error: 'Server Error: ' + error.message });
  }
});

// @route   GET /tickets
// @desc    List tickets with filters (status, priority, breached=true)
router.get('/', async (req, res) => {
  try {
    const { status, priority, breached } = req.query;
    
    // Build initial MongoDB query for non-virtual fields
    const query = {};
    if (status) {
      query.status = status;
    }
    if (priority) {
      query.priority = priority;
    }

    // Fetch matching tickets
    let tickets = await Ticket.find(query).sort({ createdAt: -1 });

    // Perform in-memory filtering for virtual 'slaBreached' field if breached param is provided
    if (breached !== undefined) {
      const targetBreach = breached === 'true';
      tickets = tickets.filter(ticket => ticket.slaBreached === targetBreach);
    }

    res.json(tickets);
  } catch (error) {
    res.status(500).json({ error: 'Server Error: ' + error.message });
  }
});

// @route   PATCH /tickets/:id
// @desc    Update a ticket (used for status transitions and general edits)
router.patch('/:id', async (req, res) => {
  try {
    const { status: newStatus, subject, description, customerEmail, priority } = req.body;
    const ticket = await Ticket.findById(req.params.id);
    
    if (!ticket) {
      return res.status(404).json({ error: 'Ticket not found' });
    }

    // If updating status, enforce transition rules
    if (newStatus !== undefined) {
      if (!isValidTransition(ticket.status, newStatus)) {
        return res.status(400).json({
          error: `Invalid status transition from '${ticket.status}' to '${newStatus}'. Skipping forward is not allowed, and moving backward is allowed only 1 step.`
        });
      }

      // Handle resolvedAt logic
      if (newStatus === 'resolved') {
        // If transitioning to resolved, record the timestamp
        ticket.resolvedAt = new Date();
      } else if (newStatus === 'open' || newStatus === 'in_progress') {
        // If moving back to open or in_progress, clear the timestamp
        ticket.resolvedAt = null;
      }
      // Note: if moving from resolved to closed, we keep the existing resolvedAt timestamp

      ticket.status = newStatus;
    }

    // Update other fields if provided
    if (subject !== undefined) ticket.subject = subject;
    if (description !== undefined) ticket.description = description;
    if (customerEmail !== undefined) ticket.customerEmail = customerEmail;
    if (priority !== undefined) ticket.priority = priority;

    await ticket.save();
    res.json(ticket);
  } catch (error) {
    if (error.name === 'ValidationError') {
      const messages = Object.values(error.errors).map(val => val.message);
      return res.status(400).json({ error: messages.join(', ') });
    }
    res.status(500).json({ error: 'Server Error: ' + error.message });
  }
});

// @route   DELETE /tickets/:id
// @desc    Delete a ticket
router.delete('/:id', async (req, res) => {
  try {
    const ticket = await Ticket.findByIdAndDelete(req.params.id);
    if (!ticket) {
      return res.status(404).json({ error: 'Ticket not found' });
    }
    res.json({ message: 'Ticket removed successfully' });
  } catch (error) {
    res.status(500).json({ error: 'Server Error: ' + error.message });
  }
});

// @route   GET /tickets/stats
// @desc    Get aggregate stats
router.get('/stats', async (req, res) => {
  try {
    const tickets = await Ticket.find({});
    
    // Aggregate by status
    const statusCounts = {
      open: 0,
      in_progress: 0,
      resolved: 0,
      closed: 0
    };

    // Aggregate by priority
    const priorityCounts = {
      low: 0,
      medium: 0,
      high: 0,
      urgent: 0
    };

    let slaBreachedOpenCount = 0;

    tickets.forEach(ticket => {
      // Status aggregation
      if (statusCounts[ticket.status] !== undefined) {
        statusCounts[ticket.status]++;
      }
      
      // Priority aggregation
      if (priorityCounts[ticket.priority] !== undefined) {
        priorityCounts[ticket.priority]++;
      }

      // SLA-breached tickets currently open (i.e. status is open or in_progress, and slaBreached is true)
      const isOpen = ticket.status === 'open' || ticket.status === 'in_progress';
      if (isOpen && ticket.slaBreached) {
        slaBreachedOpenCount++;
      }
    });

    res.json({
      status: statusCounts,
      priority: priorityCounts,
      slaBreachedOpenCount
    });
  } catch (error) {
    res.status(500).json({ error: 'Server Error: ' + error.message });
  }
});

module.exports = router;
