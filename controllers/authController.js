import mongoose from 'mongoose';
import User from '../models/User.js';
import Otp from '../models/Otp.js';
import { sendOtpEmail } from '../services/emailService.js';

// In-memory fallback database stores when MongoDB is not whitelisted/connected
const mockUserDb = new Map();
const mockOtpDb = new Map();

// Helper to validate email format
const isValidEmail = (email) => {
  const re = /^\w+([.-]?\w+)*@\w+([.-]?\w+)*(\.\w{2,3})+$/;
  return re.test(String(email).toLowerCase());
};

// ==========================================
// 1. User Registration / Signup
// ==========================================
export const signup = async (req, res) => {
  try {
    const { name, email, password } = req.body;

    // Validate inputs
    if (!name || !email || !password) {
      return res.status(400).json({ success: false, error: 'Name, email, and password are required.' });
    }

    if (!isValidEmail(email)) {
      return res.status(400).json({ success: false, error: 'Invalid email address format.' });
    }

    if (password.length < 6) {
      return res.status(400).json({ success: false, error: 'Password must be at least 6 characters long.' });
    }

    const isDbConnected = mongoose.connection.readyState === 1;
    if (!isDbConnected) {
      console.log(`⚠️ MongoDB is offline/unreachable. Using local in-memory fallback for signup (${email})`);
    }

    // Check if user already exists
    let existingUser;
    if (isDbConnected) {
      existingUser = await User.findOne({ email });
    } else {
      existingUser = mockUserDb.get(email.toLowerCase());
    }

    if (existingUser) {
      if (existingUser.isVerified) {
        return res.status(400).json({ success: false, error: 'This email is already registered and verified.' });
      }
      
      // If user exists but is unverified, update their details
      existingUser.name = name;
      existingUser.setPassword(password);
      if (isDbConnected) {
        await existingUser.save();
      } else {
        mockUserDb.set(email.toLowerCase(), existingUser);
      }
    } else {
      // Create new unverified user
      const newUser = new User({ name, email });
      newUser.setPassword(password); // Hashes and sets password
      if (isDbConnected) {
        await newUser.save();
      } else {
        mockUserDb.set(email.toLowerCase(), newUser);
      }
    }

    // Generate 6-digit OTP
    const otp = Math.floor(100000 + Math.random() * 900000).toString();

    // Save OTP to MongoDB or in-memory store
    if (isDbConnected) {
      await Otp.findOneAndUpdate(
        { email },
        { otp, createdAt: new Date() },
        { upsert: true, new: true }
      );
    } else {
      mockOtpDb.set(email.toLowerCase(), { otp, createdAt: new Date() });
    }

    // Send OTP via Nodemailer email service in the background (non-blocking)
    sendOtpEmail(email, name, otp).catch(mailError => {
      console.error('Background mail sending error in signup:', mailError.message);
    });

    return res.status(201).json({
      success: true,
      message: 'Registration successful! Verification code sent to email.',
      mockOtp: otp
    });

  } catch (error) {
    console.error('Signup error:', error);
    return res.status(500).json({ success: false, error: 'Internal server error during registration.' });
  }
};

// ==========================================
// 2. OTP Verification
// ==========================================
export const verifyOtp = async (req, res) => {
  try {
    const { email, otp } = req.body;

    if (!email || !otp) {
      return res.status(400).json({ success: false, error: 'Email and OTP are required.' });
    }

    const isDbConnected = mongoose.connection.readyState === 1;
    if (!isDbConnected) {
      console.log(`⚠️ MongoDB is offline/unreachable. Using local in-memory fallback for verifyOtp (${email})`);
    }

    // Find OTP record
    let otpRecord;
    if (isDbConnected) {
      otpRecord = await Otp.findOne({ email });
    } else {
      otpRecord = mockOtpDb.get(email.toLowerCase());
    }

    if (!otpRecord) {
      return res.status(400).json({ success: false, error: 'OTP has expired or does not exist. Please request a new one.' });
    }

    // Check if code matches
    const isMatched = otpRecord.otp === otp;
    if (!isMatched) {
      return res.status(400).json({ success: false, error: 'Incorrect OTP code. Please try again.' });
    }

    // Verify user in User collection
    let user;
    if (isDbConnected) {
      user = await User.findOne({ email });
    } else {
      user = mockUserDb.get(email.toLowerCase());
    }

    if (!user) {
      return res.status(404).json({ success: false, error: 'User account not found.' });
    }

    // Mark user as verified
    user.isVerified = true;
    if (isDbConnected) {
      await user.save();
      await Otp.deleteOne({ email });
    } else {
      mockUserDb.set(email.toLowerCase(), user);
      mockOtpDb.delete(email.toLowerCase());
    }

    return res.status(200).json({
      success: true,
      message: 'Email verified successfully! You can now log in.',
      user: {
        id: user._id || 'mock-user-id',
        name: user.name,
        email: user.email,
        isVerified: user.isVerified
      }
    });

  } catch (error) {
    console.error('Verify OTP error:', error);
    return res.status(500).json({ success: false, error: 'Internal server error during verification.' });
  }
};

// ==========================================
// 3. Resend OTP
// ==========================================
export const resendOtp = async (req, res) => {
  try {
    const { email } = req.body;

    if (!email) {
      return res.status(400).json({ success: false, error: 'Email is required.' });
    }

    const isDbConnected = mongoose.connection.readyState === 1;
    if (!isDbConnected) {
      console.log(`⚠️ MongoDB is offline/unreachable. Using local in-memory fallback for resendOtp (${email})`);
    }

    let user;
    if (isDbConnected) {
      user = await User.findOne({ email });
    } else {
      user = mockUserDb.get(email.toLowerCase());
    }

    if (!user) {
      return res.status(404).json({ success: false, error: 'No account registered with this email.' });
    }

    if (user.isVerified) {
      return res.status(400).json({ success: false, error: 'This email is already verified. No need to verify.' });
    }

    // Generate new 6-digit OTP
    const otp = Math.floor(100000 + Math.random() * 900000).toString();

    // Update OTP store
    if (isDbConnected) {
      await Otp.findOneAndUpdate(
        { email },
        { otp, createdAt: new Date() },
        { upsert: true, new: true }
      );
    } else {
      mockOtpDb.set(email.toLowerCase(), { otp, createdAt: new Date() });
    }

    // Send Email in the background (non-blocking)
    sendOtpEmail(email, user.name, otp).catch(mailError => {
      console.error('Background mail sending error in resendOtp:', mailError.message);
    });

    return res.status(200).json({
      success: true,
      message: 'New verification OTP sent to your email.',
      mockOtp: otp
    });

  } catch (error) {
    console.error('Resend OTP error:', error);
    return res.status(500).json({ success: false, error: 'Internal server error during resend.' });
  }
};
