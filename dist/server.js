import dotenv from 'dotenv';
dotenv.config();  // <-- load .env first

import express from 'express';
import { corsMiddleware } from './middleware';
import authRoutes from './authRoutes';
import leadsRoutes from './leadsRoutes';

const app = express();
const PORT = process.env.PORT || 3000;  // now picks PORT from .env

// Middleware
app.use(express.json());
app.use(corsMiddleware);

// Health check endpoint
app.get('/health', (req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

// Routes
app.use('/api/auth', authRoutes);
app.use('/api/leads', leadsRoutes);

// Error handling middleware
app.use((err, req, res, next) => {
  console.error('Server error:', err);
  res.status(500).json({ error: 'Internal server error' });
});

// 404 handler
app.use('*', (req, res) => {
  res.status(404).json({ error: 'Route not found' });
});

app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
  console.log(`Health check: http://localhost:${PORT}/health`);
  console.log(`Auth API: http://localhost:${PORT}/api/auth`);
  console.log(`Leads API: http://localhost:${PORT}/api/leads`);
});
