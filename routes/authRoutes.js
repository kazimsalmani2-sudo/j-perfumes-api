import express from 'express';
import { signup, verifyOtp, resendOtp } from '../controllers/authController.js';

const router = express.Router();

// Authentication and OTP Verification Routes
router.post('/signup', signup);
router.post('/verify-otp', verifyOtp);
router.post('/resend-otp', resendOtp);

export default router;
