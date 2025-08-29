  const express = require('express');
  const http = require('http');
  const mongoose = require('mongoose');
  const cors = require('cors');
  const path = require('path');
  require("dotenv").config();


  const User = require('./models/User');

  const app = express();
  const server = http.createServer(app);

  // socket.io with permissive CORS for deployment (adjust origin in production)
  const { Server } = require('socket.io');
  const io = new Server(server, { cors: { origin: '*' , methods: ['GET','POST'] } });

  app.use(cors());
  app.use(express.json());
  app.use(express.urlencoded({ extended: true }));
  app.use(express.static(path.join(__dirname, 'public')));

  // Mongo URI
  const MONGO_URI = process.env.MONGO_URI;
  mongoose.connect(MONGO_URI, { useNewUrlParser: true, useUnifiedTopology: true })
    .then(() => console.log('MongoDB connected'))
    .catch(err => console.error('MongoDB connect error', err));

  // Live users map: socketId -> { socketId, email, name }
  const liveUsers = new Map();

  /**
   * POST /users
   * Create a new user (validations + uniqueness checks)
   */
  app.post('/users', async (req, res) => {
    try {
      // sanitize + trim inputs
      const firstName = (req.body.firstName || '').trim();
      const lastName = (req.body.lastName || '').trim();
      const mobile = (req.body.mobile || '').trim();
      const email = (req.body.email || '').trim().toLowerCase();
      const street = (req.body.street || '').trim();
      const city = (req.body.city || '').trim();
      const state = (req.body.state || '').trim();
      const country = (req.body.country || '').trim();
      const loginId = (req.body.loginId || '').trim();
      const password = (req.body.password || '').trim();

      // regex validators
      const nameRegex = /^[A-Za-z]+$/;
      const mobileRegex = /^[0-9]{10}$/;
      const emailRegex = /^\S+@\S+\.\S+$/;
      const loginRegex = /^[A-Za-z0-9]{8}$/;
      const passwordRegex = /^(?=.*[a-z])(?=.*[A-Z])(?=.*[\W_]).{6,}$/;
      const streetRegex = /^[A-Za-z0-9\s,.-]+$/;
      const cityStateCountryRegex = /^[A-Za-z\s]+$/;

      // required checks
      if (!firstName) return res.status(400).json({ success: false, message: 'First Name is required' });
      if (!lastName) return res.status(400).json({ success: false, message: 'Last Name is required' });
      if (!mobile) return res.status(400).json({ success: false, message: 'Mobile is required' });
      if (!email) return res.status(400).json({ success: false, message: 'Email is required' });
      if (!street) return res.status(400).json({ success: false, message: 'Street is required' });
      if (!city) return res.status(400).json({ success: false, message: 'City is required' });
      if (!state) return res.status(400).json({ success: false, message: 'State is required' });
      if (!country) return res.status(400).json({ success: false, message: 'Country is required' });
      if (!loginId) return res.status(400).json({ success: false, message: 'Login ID is required' });
      if (!password) return res.status(400).json({ success: false, message: 'Password is required' });

      // format validation
      if (!nameRegex.test(firstName)) return res.status(400).json({ success: false, message: 'First Name must contain only letters' });
      if (!nameRegex.test(lastName)) return res.status(400).json({ success: false, message: 'Last Name must contain only letters' });
      if (!mobileRegex.test(mobile)) return res.status(400).json({ success: false, message: 'Mobile must be 10 digits' });
      if (!emailRegex.test(email)) return res.status(400).json({ success: false, message: 'Invalid Email format' });
      if (!streetRegex.test(street)) return res.status(400).json({ success: false, message: 'Street can only have letters, numbers and common punctuation' });
      if (!cityStateCountryRegex.test(city)) return res.status(400).json({ success: false, message: 'City must contain only letters' });
      if (!cityStateCountryRegex.test(state)) return res.status(400).json({ success: false, message: 'State must contain only letters' });
      if (!cityStateCountryRegex.test(country)) return res.status(400).json({ success: false, message: 'Country must contain only letters' });
      if (!loginRegex.test(loginId)) return res.status(400).json({ success: false, message: 'Login ID must be exactly 8 alphanumeric characters' });
      if (!passwordRegex.test(password)) return res.status(400).json({ success: false, message: 'Password must be 6+ chars with 1 uppercase, 1 lowercase & 1 special char' });

      // uniqueness checks
      const existsEmail = await User.findOne({ email });
      if (existsEmail) return res.status(400).json({ success: false, message: 'Email already exists!' });

      const existsMobile = await User.findOne({ mobile });
      if (existsMobile) return res.status(400).json({ success: false, message: 'Mobile already exists!' });

      // create and save user
      const user = new User({
        firstName,
        lastName,
        mobile,
        email,
        street,
        city,
        state,
        country,
        loginId,
        password
      });

      const saved = await user.save();
      const userObj = saved.toObject();
      delete userObj.password; // don't expose password

      // notify viewers / live pages in 'live users' room that a DB user was created
      io.to('live users').emit('user_created_db', {
        email: userObj.email,
        firstName: userObj.firstName,
        lastName: userObj.lastName,
        createdAt: userObj.createdAt,
        id: userObj._id
      });

      res.status(201).json({ success: true, message: 'User saved', user: userObj });
    } catch (err) {
      console.error('POST /users error', err);
      // if duplicate key error (just in case)
      if (err.code === 11000) {
        return res.status(400).json({ success: false, message: 'Duplicate key error' });
      }
      res.status(500).json({ success: false, message: err.message || 'Server error' });
    }
  });

  /**
   * GET /users
   * - GET /users               => list all users (no passwords)
   * - GET /users?id=<id>       => single by id
   * - GET /users?email=<email> => single by email
   */
  app.get('/users', async (req, res) => {
    try {
      const { email, id } = req.query;
      let result;
      if (id) result = await User.findById(id).select('-password').lean();
      else if (email) result = await User.findOne({ email: email.toLowerCase().trim() }).select('-password').lean();
      else result = await User.find().select('-password').lean();

      if (!result || (Array.isArray(result) && result.length === 0)) {
        return res.status(404).json({ success: false, error: 'User not found' });
      }
      return res.json({ success: true, user: result });
    } catch (err) {
      console.error('GET /users error', err);
      res.status(500).json({ success: false, error: 'Server error' });
    }
  });

  /**
   * POST /login
   * Validate email + password, return success if user exists
   */
  app.post('/login', async (req, res) => {
    try {
      const email = (req.body.email || '').trim().toLowerCase();
      const password = (req.body.password || '').trim();

      if (!email || !password) {
        return res.status(400).json({ success: false, message: 'Email and Password required' });
      }

      const user = await User.findOne({ email });
      if (!user) return res.status(400).json({ success: false, message: 'User not found' });

      if (user.password !== password) {
        return res.status(400).json({ success: false, message: 'Invalid password' });
      }

      // success
      const userObj = user.toObject();
      delete userObj.password;

      res.json({ success: true, message: 'Login successful', user: userObj });
    } catch (err) {
      console.error('POST /login error', err);
      res.status(500).json({ success: false, message: 'Server error' });
    }
  });

  /**
   * Socket.io logic
   *
   * - join_live_users: a real registered/logged-in client calls this (adds to liveUsers map)
   * - viewer_join: a viewer page calls this — it joins the socket to the room but does NOT add to liveUsers
   */

// Track online users by email
const onlineUsers = new Map();

io.on('connection', (socket) => {
  console.log('Socket connected:', socket.id);

  // Real registered user joins
  socket.on('join_live_users', async (data) => {
    const email = data && data.email ? data.email.toLowerCase().trim() : null;
    const name = `${data.firstName || ''} ${data.lastName || ''}`.trim();

    socket.join('live users');

    if (email) {
      onlineUsers.set(email, { socketId: socket.id, email, name });
      await broadcastAllUsers();
    }
  });

  // Viewer joins, no entry in onlineUsers
  socket.on('viewer_join', async () => {
    socket.join('live users');
    await broadcastAllUsers();
  });

  socket.on('leave_live_users', async () => {
    for (let [email, u] of onlineUsers.entries()) {
      if (u.socketId === socket.id) {
        onlineUsers.delete(email);
        break;
      }
    }
    await broadcastAllUsers();
  });

  socket.on('disconnect', async () => {
    console.log('Socket disconnected:', socket.id);
    for (let [email, u] of onlineUsers.entries()) {
      if (u.socketId === socket.id) {
        onlineUsers.delete(email);
        break;
      }
    }
    await broadcastAllUsers();
  });
});

// Helper: broadcast all registered users with online/offline flag
async function broadcastAllUsers() {
  try {
    const allUsers = await User.find().select('-password').lean();
    const merged = allUsers.map((u) => ({
      ...u,
      isOnline: onlineUsers.has(u.email),
      socketId: onlineUsers.get(u.email)?.socketId || null,
    }));
    io.to('live users').emit('live_users_update', merged);
  } catch (err) {
    console.error('broadcastAllUsers error:', err);
  }
}



  // io.on('connection', (socket) => {
  //   console.log('Socket connected:', socket.id);

  //   // real user joins live users (they supply their email)
  //   socket.on('join_live_users', (data) => {
  //     const email = data && data.email ? (data.email.toLowerCase().trim()) : null;
  //     const name = `${data.firstName || ''} ${data.lastName || ''}`.trim();

  //     // join the room so viewers get DB created notifications as well
  //     socket.join('live users');

  //     if (email) {
  //       liveUsers.set(socket.id, { socketId: socket.id, email, name });
  //       io.to('live users').emit('live_users_update', Array.from(liveUsers.values()));
  //     }
  //   });

  //   // viewer joins the room but is NOT added to liveUsers
  //   socket.on('viewer_join', () => {
  //     socket.join('live users');
  //     // optionally send current live users to the viewer only
  //     socket.emit('live_users_update', Array.from(liveUsers.values()));
  //   });

  //   socket.on('leave_live_users', () => {
  //     socket.leave('live users');
  //     liveUsers.delete(socket.id);
  //     io.to('live users').emit('live_users_update', Array.from(liveUsers.values()));
  //   });

  //   socket.on('disconnect', () => {
  //     console.log('Socket disconnected:', socket.id);
  //     liveUsers.delete(socket.id);
  //     io.to('live users').emit('live_users_update', Array.from(liveUsers.values()));
  //   });
  // });

  // start server
  const PORT = process.env.PORT || 3000;
  server.listen(PORT, () => console.log(`Server running on port ${PORT}`));
