import mongoose from 'mongoose';

const otpSchema = new mongoose.Schema({
  email: {
    type: String,
    required: [true, 'Email is required'],
    lowercase: true,
    trim: true
  },
  otp: {
    type: String,
    required: [true, 'OTP code is required']
  },
  createdAt: {
    type: Date,
    default: Date.now,
    expires: 300 // Automatic deletion by MongoDB after 5 minutes (300 seconds)
  }
});

export default mongoose.model('Otp', otpSchema);
