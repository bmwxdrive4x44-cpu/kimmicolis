import { createServer } from 'http';
import { Server } from 'socket.io';
import cors from 'cors';

const PORT = 3003;

const httpServer = createServer();
const io = new Server(httpServer, {
  cors: {
    origin: '*',
    methods: ['GET', 'POST'],
  },
});

// Store connected users and their rooms
const userRooms = new Map<string, Set<string>>();

io.on('connection', (socket) => {
  console.log(`Client connected: ${socket.id}`);

  // Join a tracking room for a specific parcel
  socket.on('join-tracking', (trackingNumber: string) => {
    socket.join(`tracking:${trackingNumber}`);
    console.log(`Client ${socket.id} joined tracking:${trackingNumber}`);
    
    // Send current status (simulated)
    socket.emit('tracking-update', {
      trackingNumber,
      status: 'EN_TRANSPORT',
      location: {
        lat: 36.7538,
        lng: 3.0588,
        city: 'Alger',
      },
      timestamp: new Date().toISOString(),
    });
  });

  // Leave a tracking room
  socket.on('leave-tracking', (trackingNumber: string) => {
    socket.leave(`tracking:${trackingNumber}`);
    console.log(`Client ${socket.id} left tracking:${trackingNumber}`);
  });

  // Update parcel location (from transporter)
  socket.on('update-location', (data: {
    trackingNumber: string;
    location: { lat: number; lng: number; city: string };
    status: string;
  }) => {
    const { trackingNumber, location, status } = data;
    
    // Broadcast to all clients tracking this parcel
    io.to(`tracking:${trackingNumber}`).emit('tracking-update', {
      trackingNumber,
      status,
      location,
      timestamp: new Date().toISOString(),
    });
    
    console.log(`Location update for ${trackingNumber}:`, location);
  });

  // Update parcel status
  socket.on('update-status', (data: {
    trackingNumber: string;
    status: string;
    notes?: string;
  }) => {
    const { trackingNumber, status, notes } = data;
    
    io.to(`tracking:${trackingNumber}`).emit('status-update', {
      trackingNumber,
      status,
      notes,
      timestamp: new Date().toISOString(),
    });
    
    console.log(`Status update for ${trackingNumber}: ${status}`);
  });

  // Handle disconnect
  socket.on('disconnect', () => {
    console.log(`Client disconnected: ${socket.id}`);
    userRooms.delete(socket.id);
  });
});

// Simulate location updates for demo
setInterval(() => {
  const demoTrackingNumbers = ['SCDEMO001', 'SCDEMO002'];
  
  demoTrackingNumbers.forEach((trackingNumber) => {
    io.to(`tracking:${trackingNumber}`).emit('tracking-update', {
      trackingNumber,
      status: 'EN_TRANSPORT',
      location: {
        lat: 36.7538 + (Math.random() - 0.5) * 0.1,
        lng: 3.0588 + (Math.random() - 0.5) * 0.1,
        city: 'Near Alger',
      },
      timestamp: new Date().toISOString(),
    });
  });
}, 10000); // Every 10 seconds

httpServer.listen(PORT, () => {
  console.log(`SwiftColis Tracking Service running on port ${PORT}`);
});
