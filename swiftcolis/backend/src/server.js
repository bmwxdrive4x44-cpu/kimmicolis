const express = require('express');
const cors = require('cors');
const http = require('http');
const socketIo = require('socket.io');
require('dotenv').config();

const authRoutes = require('./routes/authRoutes');
const colisRoutes = require('./routes/colisRoutes');
const relaisRoutes = require('./routes/relaisRoutes');
const transporteurRoutes = require('./routes/transporteurRoutes');
const adminRoutes = require('./routes/adminRoutes');

const app = express();
const server = http.createServer(app);

// Socket.IO setup for real-time tracking
const io = socketIo(server, {
  cors: {
    origin: process.env.FRONTEND_URL || 'http://localhost:3000',
    methods: ['GET', 'POST']
  }
});

// Store io instance for use in controllers
app.set('io', io);

// Middleware
app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Request logging middleware
app.use((req, res, next) => {
  console.log(`${new Date().toISOString()} - ${req.method} ${req.path}`);
  next();
});

// API Routes
app.use('/api/auth', authRoutes);
app.use('/api/colis', colisRoutes);
app.use('/api/relais', relaisRoutes);
app.use('/api/transporteur', transporteurRoutes);
app.use('/api/admin', adminRoutes);

// Health check endpoint
app.get('/api/health', (req, res) => {
  res.json({ 
    success: true, 
    message: 'SwiftColis API is running',
    timestamp: new Date().toISOString()
  });
});

// Socket.IO connection handling
io.on('connection', (socket) => {
  console.log('✅ Client connected:', socket.id);

  // Join a room to track specific package
  socket.on('join_colis_room', (colisId) => {
    socket.join(`colis_${colisId}`);
    console.log(`Client ${socket.id} joined room colis_${colisId}`);
  });

  // Leave a room
  socket.on('leave_colis_room', (colisId) => {
    socket.leave(`colis_${colisId}`);
    console.log(`Client ${socket.id} left room colis_${colisId}`);
  });

  // Handle disconnection
  socket.on('disconnect', () => {
    console.log('❌ Client disconnected:', socket.id);
  });
});

// 404 handler
app.use((req, res) => {
  res.status(404).json({
    success: false,
    message: 'Route non trouvée'
  });
});

// Error handling middleware
app.use((err, req, res, next) => {
  console.error('Error:', err.stack);
  res.status(500).json({
    success: false,
    message: 'Erreur serveur interne',
    error: process.env.NODE_ENV === 'development' ? err.message : undefined
  });
});

// Start server
const PORT = process.env.PORT || 5000;

server.listen(PORT, () => {
  console.log(`
╔═══════════════════════════════════════════════════════════╗
║                                                           ║
║   🚀 SwiftColis API Server                                ║
║                                                           ║
║   Server running on port ${PORT}                            ║
║   Environment: ${process.env.NODE_ENV || 'development'}                             ║
║   WebSocket: Enabled                                      ║
║                                                           ║
║   Endpoints:                                              ║
║   - POST   /api/auth/register                             ║
║   - POST   /api/auth/login                                ║
║   - GET    /api/colis                                     ║
║   - POST   /api/relais/register                           ║
║   - POST   /api/transporteur/trajets                      ║
║   - GET    /api/admin/stats                               ║
║                                                           ║
╚═══════════════════════════════════════════════════════════╝
  `);
});

module.exports = { app, io };
