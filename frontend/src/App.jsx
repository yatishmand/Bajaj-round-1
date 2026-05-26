import React, { useState, useEffect } from 'react';
import './App.css';

const API_BASE = 'http://localhost:5000';
const STATUSES = ['open', 'in_progress', 'resolved', 'closed'];
const STATUS_LABELS = {
  open: 'Open',
  in_progress: 'In Progress',
  resolved: 'Resolved',
  closed: 'Closed'
};

const PRIORITY_LIMITS = {
  urgent: '1 hour',
  high: '4 hours',
  medium: '24 hours',
  low: '72 hours'
};

export default function App() {
  const [tickets, setTickets] = useState([]);
  const [stats, setStats] = useState({
    status: { open: 0, in_progress: 0, resolved: 0, closed: 0 },
    priority: { low: 0, medium: 0, high: 0, urgent: 0 },
    slaBreachedOpenCount: 0
  });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  
  // Filters
  const [filterPriority, setFilterPriority] = useState('');
  const [filterBreached, setFilterBreached] = useState(false);

  // Form State
  const [form, setForm] = useState({
    subject: '',
    description: '',
    customerEmail: '',
    priority: 'medium'
  });
  const [formErrors, setFormErrors] = useState({});
  const [formSubmitting, setFormSubmitting] = useState(false);
  const [formSuccess, setFormSuccess] = useState('');

  // Drag and status transition feedback
  const [transitionError, setTransitionError] = useState({ ticketId: '', message: '' });

  // Load tickets and stats
  const fetchData = async () => {
    setLoading(true);
    setError('');
    try {
      // Build filter parameters
      const params = new URLSearchParams();
      if (filterPriority) params.append('priority', filterPriority);
      if (filterBreached) params.append('breached', 'true');

      const [ticketsRes, statsRes] = await Promise.all([
        fetch(`${API_BASE}/tickets?${params.toString()}`),
        fetch(`${API_BASE}/tickets/stats`)
      ]);

      if (!ticketsRes.ok || !statsRes.ok) {
        throw new Error('Failed to fetch data from server');
      }

      const ticketsData = await ticketsRes.json();
      const statsData = await statsRes.json();

      setTickets(ticketsData);
      setStats(statsData);
    } catch (err) {
      setError(err.message || 'Something went wrong');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, [filterPriority, filterBreached]);

  // Utility to format age minutes
  const formatAge = (mins) => {
    if (mins < 60) {
      return `${mins}m`;
    }
    const hours = Math.floor(mins / 60);
    const remainingMins = mins % 60;
    return `${hours}h ${remainingMins}m`;
  };

  // Input change handler
  const handleInputChange = (e) => {
    const { name, value } = e.target;
    setForm(prev => ({ ...prev, [name]: value }));
    // Clear inline error when typing
    if (formErrors[name]) {
      setFormErrors(prev => ({ ...prev, [name]: '' }));
    }
  };

  // Form validation
  const validateForm = () => {
    const errors = {};
    if (!form.subject.trim()) {
      errors.subject = 'Subject is required';
    }
    if (!form.description.trim()) {
      errors.description = 'Description is required';
    }
    if (!form.customerEmail.trim()) {
      errors.customerEmail = 'Customer Email is required';
    } else {
      const emailRegex = /^\w+([.-]?\w+)*@\w+([.-]?\w+)*(\.\w{2,3})+$/;
      if (!emailRegex.test(form.customerEmail)) {
        errors.customerEmail = 'Please enter a valid email address';
      }
    }
    setFormErrors(errors);
    return Object.keys(errors).length === 0;
  };

  // Submit new ticket
  const handleCreateTicket = async (e) => {
    e.preventDefault();
    setFormSuccess('');
    if (!validateForm()) return;

    setFormSubmitting(true);
    try {
      const res = await fetch(`${API_BASE}/tickets`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(form)
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || 'Failed to create ticket');
      }

      setFormSuccess('Ticket created successfully!');
      // Reset form fields
      setForm({
        subject: '',
        description: '',
        customerEmail: '',
        priority: 'medium'
      });
      // Refresh board and stats
      fetchData();
    } catch (err) {
      setFormErrors({ form: err.message });
    } finally {
      setFormSubmitting(false);
    }
  };

  // Update status (transition)
  const handleStatusTransition = async (ticketId, newStatus) => {
    setTransitionError({ ticketId: '', message: '' });
    try {
      const res = await fetch(`${API_BASE}/tickets/${ticketId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: newStatus })
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || 'Failed to update ticket status');
      }

      // Refresh data
      fetchData();
    } catch (err) {
      setTransitionError({ ticketId, message: err.message });
      // Clear error after 5 seconds
      setTimeout(() => {
        setTransitionError(prev => prev.ticketId === ticketId ? { ticketId: '', message: '' } : prev);
      }, 5000);
    }
  };

  // Delete ticket
  const handleDeleteTicket = async (ticketId) => {
    if (!window.confirm('Are you sure you want to delete this ticket?')) return;
    try {
      const res = await fetch(`${API_BASE}/tickets/${ticketId}`, {
        method: 'DELETE'
      });
      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || 'Failed to delete ticket');
      }
      fetchData();
    } catch (err) {
      alert(err.message);
    }
  };

  // Drag and drop events
  const handleDragStart = (e, ticketId) => {
    e.dataTransfer.setData('text/plain', ticketId);
    e.currentTarget.classList.add('dragging');
  };

  const handleDragEnd = (e) => {
    e.currentTarget.classList.remove('dragging');
  };

  const handleDrop = (e, columnStatus) => {
    e.preventDefault();
    const ticketId = e.dataTransfer.getData('text/plain');
    if (ticketId) {
      handleStatusTransition(ticketId, columnStatus);
    }
  };

  // Helper to check if button status move is valid
  const getNextStatus = (currentStatus) => {
    const idx = STATUSES.indexOf(currentStatus);
    if (idx < STATUSES.length - 1) return STATUSES[idx + 1];
    return null;
  };

  const getPrevStatus = (currentStatus) => {
    const idx = STATUSES.indexOf(currentStatus);
    if (idx > 0) return STATUSES[idx - 1];
    return null;
  };

  return (
    <div className="app-container">
      {/* Student Profile Header */}
      <header className="app-header">
        <div className="header-title">
          <h1>DeskFlow — Support Ticket Board</h1>
          <p className="subtitle">MERN Coding Assessment</p>
        </div>
        <div className="student-info">
          <div><strong>Candidate Name:</strong> Yatish Mandowara</div>
          <div><strong>Email:</strong> yatishmandowara231012@acropolis.in</div>
          <div><strong>Roll Number:</strong> 0827CI231155</div>
        </div>
      </header>

      {/* Stats Strip */}
      <section className="stats-strip">
        <h3>Metrics Panel</h3>
        <div className="stats-grid">
          {STATUSES.map(status => (
            <div key={status} className="stat-card">
              <span className="stat-label">{STATUS_LABELS[status]}:</span>
              <span className="stat-value">{stats.status[status] || 0}</span>
            </div>
          ))}
          <div className="stat-card breached">
            <span className="stat-label">SLA Breached (Open):</span>
            <span className="stat-value">{stats.slaBreachedOpenCount || 0}</span>
          </div>
        </div>
      </section>

      {/* Controls / Filters */}
      <section className="controls-panel">
        <div className="filters-container">
          <label htmlFor="priority-filter">Filter by Priority:</label>
          <select 
            id="priority-filter" 
            value={filterPriority} 
            onChange={(e) => setFilterPriority(e.target.value)}
          >
            <option value="">All Priorities</option>
            <option value="low">Low</option>
            <option value="medium">Medium</option>
            <option value="high">High</option>
            <option value="urgent">Urgent</option>
          </select>

          <label className="checkbox-label">
            <input 
              type="checkbox" 
              checked={filterBreached} 
              onChange={(e) => setFilterBreached(e.target.checked)}
            />
            Show SLA-Breached Only
          </label>
        </div>
        <button className="btn-refresh" onClick={fetchData} disabled={loading}>
          {loading ? 'Refreshing...' : 'Force Refresh Data'}
        </button>
      </section>

      {error && <div className="error-message">Error loading data: {error}</div>}

      {/* Triage Board */}
      <main className="board-container">
        {STATUSES.map(status => {
          const statusTickets = tickets.filter(t => t.status === status);
          return (
            <div 
              key={status} 
              className={`board-column status-${status}`}
              onDragOver={(e) => e.preventDefault()}
              onDrop={(e) => handleDrop(e, status)}
            >
              <div className="column-header">
                <h2>{STATUS_LABELS[status]} ({statusTickets.length})</h2>
              </div>
              <div className="column-cards">
                {statusTickets.length === 0 ? (
                  <div className="empty-column-placeholder">No tickets in this state</div>
                ) : (
                  statusTickets.map(ticket => {
                    const nextStatus = getNextStatus(ticket.status);
                    const prevStatus = getPrevStatus(ticket.status);
                    
                    return (
                      <div 
                        key={ticket._id} 
                        className={`ticket-card ${ticket.slaBreached ? 'sla-breached' : ''}`}
                        draggable
                        onDragStart={(e) => handleDragStart(e, ticket._id)}
                        onDragEnd={handleDragEnd}
                      >
                        <div className="card-top">
                          <span className={`priority-badge priority-${ticket.priority}`}>
                            {ticket.priority.toUpperCase()}
                          </span>
                          <span className="ticket-age" title="Time elapsed (stops when resolved/closed)">
                            ⏳ {formatAge(ticket.ageMinutes)}
                          </span>
                        </div>

                        <h3 className="ticket-subject">{ticket.subject}</h3>
                        <p className="ticket-desc">{ticket.description}</p>
                        
                        <div className="ticket-meta">
                          <div><strong>From:</strong> {ticket.customerEmail}</div>
                          <div><strong>Created:</strong> {new Date(ticket.createdAt).toLocaleString()}</div>
                          {ticket.resolvedAt && (
                            <div><strong>Resolved:</strong> {new Date(ticket.resolvedAt).toLocaleString()}</div>
                          )}
                        </div>

                        {ticket.slaBreached && (
                          <div className="sla-alert">
                            ⚠️ SLA BREACHED! ({PRIORITY_LIMITS[ticket.priority]} target exceeded)
                          </div>
                        )}

                        {transitionError.ticketId === ticket._id && (
                          <div className="card-transition-error">
                            ⚠️ {transitionError.message}
                          </div>
                        )}

                        <div className="card-actions">
                          <div className="status-move-buttons">
                            {prevStatus && (
                              <button 
                                className="btn-move btn-back"
                                onClick={() => handleStatusTransition(ticket._id, prevStatus)}
                                title={`Move back to ${STATUS_LABELS[prevStatus]}`}
                              >
                                ← Back
                              </button>
                            )}
                            {nextStatus && (
                              <button 
                                className="btn-move btn-forward"
                                onClick={() => handleStatusTransition(ticket._id, nextStatus)}
                                title={`Move forward to ${STATUS_LABELS[nextStatus]}`}
                              >
                                Next →
                              </button>
                            )}
                          </div>
                          <button 
                            className="btn-delete"
                            onClick={() => handleDeleteTicket(ticket._id)}
                            title="Delete Ticket"
                          >
                            Delete
                          </button>
                        </div>
                      </div>
                    );
                  })
                )}
              </div>
            </div>
          );
        })}
      </main>

      {/* Create Ticket Panel */}
      <section className="form-section">
        <h2>Submit Support Ticket</h2>
        <form onSubmit={handleCreateTicket} className="ticket-form">
          {formErrors.form && <div className="error-message">{formErrors.form}</div>}
          {formSuccess && <div className="success-message">{formSuccess}</div>}

          <div className="form-grid">
            <div className="form-group">
              <label htmlFor="subject">Subject *</label>
              <input 
                type="text" 
                id="subject"
                name="subject"
                value={form.subject}
                onChange={handleInputChange}
                placeholder="e.g. Server connectivity down"
              />
              {formErrors.subject && <span className="inline-error">{formErrors.subject}</span>}
            </div>

            <div className="form-group">
              <label htmlFor="customerEmail">Customer Email *</label>
              <input 
                type="email" 
                id="customerEmail"
                name="customerEmail"
                value={form.customerEmail}
                onChange={handleInputChange}
                placeholder="e.g. customer@example.com"
              />
              {formErrors.customerEmail && <span className="inline-error">{formErrors.customerEmail}</span>}
            </div>

            <div className="form-group">
              <label htmlFor="priority">Priority *</label>
              <select 
                id="priority"
                name="priority"
                value={form.priority}
                onChange={handleInputChange}
              >
                <option value="low">Low (72 hours target)</option>
                <option value="medium">Medium (24 hours target)</option>
                <option value="high">High (4 hours target)</option>
                <option value="urgent">Urgent (1 hour target)</option>
              </select>
            </div>

            <div className="form-group full-width">
              <label htmlFor="description">Detailed Description *</label>
              <textarea 
                id="description"
                name="description"
                value={form.description}
                onChange={handleInputChange}
                rows="3"
                placeholder="Describe the issue in detail..."
              ></textarea>
              {formErrors.description && <span className="inline-error">{formErrors.description}</span>}
            </div>
          </div>

          <button type="submit" className="btn-submit" disabled={formSubmitting}>
            {formSubmitting ? 'Creating...' : 'Create Ticket'}
          </button>
        </form>
      </section>

      {/* Footer Info */}
      <footer className="app-footer">
        <p>DeskFlow Support Ticket Triage Board &bull; Designed by Yatish Mandowara (Roll No: 0827CI231155)</p>
      </footer>
    </div>
  );
}
