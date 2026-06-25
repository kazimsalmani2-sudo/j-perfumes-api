import dotenv from 'dotenv';
dotenv.config();

import express from 'express';
import cors from 'cors';
import crypto from 'crypto';
import nodemailer from 'nodemailer';
import mongoose from 'mongoose';
import authRoutes from './routes/authRoutes.js';
import uploadRoutes from './routes/uploadRoutes.js';

// Connect to MongoDB Atlas
mongoose.connect(process.env.MONGO_URI)
  .then(() => console.log('🍃 Connected to MongoDB Atlas'))
  .catch((err) => console.error('❌ MongoDB Connection Error:', err.message));

// Configure Nodemailer transporter using credentials from .env
const cleanPass = (process.env.EMAIL_PASS || '').replace(/\s+/g, '');
const transporter = nodemailer.createTransport({
  host: 'smtp.gmail.com',
  port: 465,
  secure: true,
  auth: {
    user: process.env.EMAIL_USER,
    pass: cleanPass
  },
  tls: {
    rejectUnauthorized: false
  }
});

// Verify connection configuration
transporter.verify((error, success) => {
  if (error) {
    console.error('📧 Nodemailer configuration error:', error.message);
  } else {
    console.log('📧 Server is ready to send OTP emails');
  }
});

const app = express();
const PORT = process.env.PORT || 5000;

// Middleware
app.use(cors());
app.use(express.json());

// Auth routes
app.use('/auth', authRoutes);

// Upload routes
app.use('/upload', uploadRoutes);

// Root URL
app.get('/', (req, res) => {
  res.send('Welcome to J Perfumewala API!');
});

// API Base URL
app.get('/api', (req, res) => {
  res.json({ message: 'Welcome to J Perfumewala API Endpoint!' });
});

// Health check
app.get('/health', (req, res) => {
  res.json({ status: 'ok', message: 'J Perfumewala Backend is running' });
});

// ============================================================
// RAZORPAY PAYMENT ROUTES
// ============================================================

// Create Razorpay order
app.post('/payment/create-order', async (req, res) => {
  try {
    const { amount, currency = 'INR', receipt } = req.body;

    if (!amount || amount <= 0) {
      return res.status(400).json({ error: 'Invalid amount' });
    }

    const RAZORPAY_KEY_ID = process.env.RAZORPAY_KEY_ID;
    const RAZORPAY_KEY_SECRET = process.env.RAZORPAY_KEY_SECRET;

    if (!RAZORPAY_KEY_ID || !RAZORPAY_KEY_SECRET) {
      // Mock order for development (no Razorpay keys configured)
      const mockOrder = {
        id: `order_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
        amount: Math.round(amount * 100),
        currency,
        receipt: receipt || `order_${Date.now()}`,
        status: 'created',
      };
      return res.json(mockOrder);
    }

    // Real Razorpay API call
    const orderData = {
      amount: Math.round(amount * 100), // Convert to paise
      currency,
      receipt: receipt || `order_${Date.now()}`,
    };

    const credentials = Buffer.from(`${RAZORPAY_KEY_ID}:${RAZORPAY_KEY_SECRET}`).toString('base64');

    const response = await fetch('https://api.razorpay.com/v1/orders', {
      method: 'POST',
      headers: {
        'Authorization': `Basic ${credentials}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(orderData),
    });

    if (!response.ok) {
      const errData = await response.json();
      return res.status(response.status).json({ error: errData.error?.description || 'Order creation failed' });
    }

    const order = await response.json();
    res.json(order);

  } catch (error) {
    console.error('Create order error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Verify Razorpay payment signature
app.post('/payment/verify', (req, res) => {
  try {
    const {
      razorpay_order_id,
      razorpay_payment_id,
      razorpay_signature,
    } = req.body;

    if (!razorpay_order_id || !razorpay_payment_id || !razorpay_signature) {
      return res.status(400).json({ verified: false, error: 'Missing payment details' });
    }

    const RAZORPAY_KEY_SECRET = process.env.RAZORPAY_KEY_SECRET;

    if (!RAZORPAY_KEY_SECRET) {
      // Mock verification for development
      console.log('⚠️  No Razorpay secret configured — using mock verification');
      return res.json({ verified: true, paymentId: razorpay_payment_id, orderId: razorpay_order_id });
    }

    // Verify HMAC-SHA256 signature
    const expectedSignature = crypto
      .createHmac('sha256', RAZORPAY_KEY_SECRET)
      .update(`${razorpay_order_id}|${razorpay_payment_id}`)
      .digest('hex');

    const isValid = expectedSignature === razorpay_signature;

    if (isValid) {
      res.json({ verified: true, paymentId: razorpay_payment_id, orderId: razorpay_order_id });
    } else {
      res.status(400).json({ verified: false, error: 'Invalid payment signature' });
    }

  } catch (error) {
    console.error('Verify payment error:', error);
    res.status(500).json({ verified: false, error: 'Internal server error' });
  }
});

// COD order confirmation
app.post('/payment/cod-confirm', (req, res) => {
  try {
    const { orderId, total, deliveryDetails } = req.body;

    if (!orderId || !total) {
      return res.status(400).json({ error: 'Missing order details' });
    }

    // In production, save this to a database
    console.log(`📦 COD Order Confirmed: ${orderId} — ₹${total}`);

    res.json({
      success: true,
      orderId,
      message: 'Cash on Delivery order confirmed',
      estimatedDelivery: '3-5 business days',
    });

  } catch (error) {
    console.error('COD confirm error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// ============================================================
// OTP VERIFICATION ROUTES
// ============================================================

// Temporary in-memory store for generated OTPs (keyed by email or phone)
const otpStore = new Map();

// Send OTP
app.post('/otp/send', async (req, res) => {
  try {
    const { email, phone } = req.body;
    const identifier = email || phone;
    if (!identifier) {
      return res.status(400).json({ error: 'Email or phone number is required' });
    }

    // Generate a 4-digit OTP (e.g. 1000 to 9999)
    const otp = Math.floor(1000 + Math.random() * 9000).toString();
    
    // Store in-memory with a timestamp (expires in 5 minutes)
    otpStore.set(identifier, {
      otp,
      expiresAt: Date.now() + 5 * 60 * 1000
    });

    console.log(`\n==================================================`);
    console.log(`[OTP] Generated for ${identifier}: ${otp}`);
    console.log(`==================================================\n`);

    // Send email using Nodemailer if email is provided
    let emailSent = false;
    let emailError = null;

    if (email && process.env.EMAIL_USER && process.env.EMAIL_PASS) {
      const mailOptions = {
        from: `"J Perfumewala" <${process.env.EMAIL_USER}>`,
        to: email,
        subject: `${otp} is your J Perfumewala verification code`,
        html: `
          <div style="font-family: Arial, sans-serif; max-width: 500px; margin: 0 auto; padding: 30px; border: 1px solid #e5d5b0; border-radius: 8px; background-color: #fafaf7; color: #1a1a1a;">
            <div style="text-align: center; margin-bottom: 25px; border-bottom: 2px solid #e5d5b0; padding-bottom: 20px;">
              <h1 style="color: #b8960c; margin: 0; font-size: 26px; font-weight: 600; letter-spacing: 2px; text-transform: uppercase;">J Perfumewala</h1>
              <p style="color: #666; font-size: 11px; margin: 5px 0 0 0; letter-spacing: 4px; text-transform: uppercase;">Luxury Fragrances</p>
            </div>
            
            <div style="padding: 10px 0;">
              <h2 style="font-size: 18px; font-weight: 500; margin-top: 0; color: #333;">Verify Your Email Address</h2>
              <p style="font-size: 14px; line-height: 1.6; color: #555;">Thank you for shopping with us. Please use the following One-Time Password (OTP) to complete your secure checkout process:</p>
              
              <div style="background-color: #ffffff; border: 1px solid #e3e3dc; padding: 20px; border-radius: 6px; text-align: center; margin: 25px 0;">
                <span style="font-size: 36px; font-weight: 700; letter-spacing: 8px; color: #b8960c; padding-left: 8px;">${otp}</span>
              </div>
              
              <p style="font-size: 12px; color: #888; line-height: 1.5;">This code is valid for <strong>5 minutes</strong>. For security reasons, please do not share this code with anyone.</p>
            </div>
            
            <div style="text-align: center; margin-top: 30px; border-top: 1px solid #e5d5b0; padding-top: 20px; font-size: 11px; color: #999;">
              <p style="margin: 0 0 5px 0;">If you did not request this code, you can safely ignore this email.</p>
              <p style="margin: 0;">© 2026 J Perfumewala Luxury Fragrances. All rights reserved.</p>
            </div>
          </div>
        `,
      };

      try {
        await transporter.sendMail(mailOptions);
        emailSent = true;
        console.log(`[OTP] ✅ Email sent successfully to ${email}`);
      } catch (mailErr) {
        emailError = mailErr.message;
        console.error(`[OTP] ❌ Email FAILED for ${email}:`, mailErr.message);
        console.error(`[OTP] ℹ️  Check Gmail App Password in backend/.env`);
        console.log(`[OTP] 🔑 Use this OTP manually: ${otp}`);
      }
    } else {
      console.log(`[OTP] Email skipped — EMAIL_USER or EMAIL_PASS not configured in .env`);
    }

    // Always return success so checkout can proceed
    res.json({
      success: true,
      message: emailSent ? `Verification code sent to ${email}` : 'Verification code generated',
      mockOtp: otp,
      emailSent,
      ...(emailError && { emailWarning: 'Email delivery failed. Check server console for OTP.' }),
    });
  } catch (error) {
    console.error('Send OTP error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Verify OTP
app.post('/otp/verify', (req, res) => {
  try {
    const { email, phone, otp } = req.body;
    const identifier = email || phone;
    if (!identifier || !otp) {
      return res.status(400).json({ error: 'Email/phone and OTP are required' });
    }

    const record = otpStore.get(identifier);
    if (!record) {
      return res.status(400).json({ verified: false, error: 'No OTP requested for these details' });
    }

    if (Date.now() > record.expiresAt) {
      otpStore.delete(identifier);
      return res.status(400).json({ verified: false, error: 'OTP has expired' });
    }

    const isValid = record.otp === otp;

    if (isValid) {
      otpStore.delete(identifier); // Burn OTP after verification
      res.json({ verified: true, message: 'OTP verified successfully' });
    } else {
      res.status(400).json({ verified: false, error: 'Invalid OTP' });
    }
  } catch (error) {
    console.error('Verify OTP error:', error);
    res.status(500).json({ verified: false, error: 'Internal server error' });
  }
});


// ============================================================
// GROK AI CHATBOT — FRAGRANCE ADVISOR
// ============================================================

// Full product catalog for Grok context
const PRODUCT_CATALOG = [
  {
    id: 8, name: "Ambre Lumière", price: 4200, gender: "Unisex",
    fragranceFamily: "Oriental", category: "unisex", collection: "royal-oud",
    topNotes: ["Orange Blossom", "Ginger", "Nutmeg"],
    heartNotes: ["Amber", "Cedarwood", "Cinnamon"],
    baseNotes: ["Musk", "Sandalwood", "Vanilla"],
    description: "Warm, enveloping amber and spices. Perfect for cool evenings and formal occasions.",
    slug: "ambre-lumiere", image: "https://res.cloudinary.com/douw1swxz/image/upload/v1782358149/j-perfume-products/s7ti2co7f50qar9vnbca.jpg",
    suitableSkinTypes: ["all"], occasions: ["evening", "special"],
  },
  {
    id: 6, name: "Aqua Lumière", price: 3600, gender: "Men",
    fragranceFamily: "Fresh", category: "men", collection: "pour-homme",
    topNotes: ["Sea Salt", "Citrus", "Green Tea"],
    heartNotes: ["Aquatic Notes", "Geranium", "Jasmine"],
    baseNotes: ["Driftwood", "White Musk", "Ambergris"],
    description: "Fresh, marine, Mediterranean. Ideal for daily wear and office.",
    slug: "aqua-lumiere", image: "https://res.cloudinary.com/douw1swxz/image/upload/v1782358151/j-perfume-products/nor9mfnvkoke1hvk0dvy.jpg",
    suitableSkinTypes: ["oily", "combination"], occasions: ["daily", "office"],
  },
  {
    id: 4, name: "Blanche Iris", price: 3200, gender: "Women",
    fragranceFamily: "Fresh", category: "women", collection: "pour-femme",
    topNotes: ["Bergamot", "Mandarin", "White Peach"],
    heartNotes: ["Iris", "Violet", "Orris Root"],
    baseNotes: ["White Musk", "Cedarwood", "Cashmere"],
    description: "Cool, delicate, powdery elegance. Great for daytime and office.",
    slug: "blanche-iris", image: "https://res.cloudinary.com/douw1swxz/image/upload/v1782358148/j-perfume-products/yp2sbnhev8w2vs9uckzh.jpg",
    suitableSkinTypes: ["dry", "normal"], occasions: ["daily", "office"],
  },
  {
    id: 9, name: "Desert Oud", price: 7500, gender: "Men",
    fragranceFamily: "Oud", category: "men", collection: "royal-oud",
    topNotes: ["Grapefruit", "Cardamom", "Bergamot"],
    heartNotes: ["Oud", "Agarwood", "Vetiver"],
    baseNotes: ["Oud", "Sandalwood", "Amber"],
    description: "Raw, powerful oud. For bold personalities. Evening and special occasions.",
    slug: "desert-oud", image: "https://res.cloudinary.com/douw1swxz/image/upload/v1782358151/j-perfume-products/dtucliblwytxyzdjdusu.jpg",
    suitableSkinTypes: ["all"], occasions: ["evening", "special"],
  },
  {
    id: 7, name: "Jasmine Noir", price: 4400, gender: "Women",
    fragranceFamily: "Floral", category: "women", collection: "pour-femme",
    topNotes: ["Black Currant", "Dark Plum", "Bergamot"],
    heartNotes: ["Jasmine Sambac", "Tuberose", "Gardenia"],
    baseNotes: ["Dark Woods", "Patchouli", "Benzoin"],
    description: "Dark, sensual floral. Mysterious and alluring. Evening wear.",
    slug: "jasmine-noir", image: "https://res.cloudinary.com/douw1swxz/image/upload/v1782358153/j-perfume-products/ejjqrtieopjhwuttvtdu.jpg",
    suitableSkinTypes: ["dry", "normal"], occasions: ["evening", "special"],
  },
  {
    id: 1, name: "Noir Élite EDP", price: 4200, gender: "Men",
    fragranceFamily: "Woody", category: "men", collection: "pour-homme",
    topNotes: ["Bergamot", "Black Pepper", "Grapefruit"],
    heartNotes: ["Cedarwood", "Vetiver", "Tobacco"],
    baseNotes: ["Musk", "Amber", "Sandalwood"],
    description: "Bold woody-spicy for modern men. Office to evening.",
    slug: "noir-elite-edp", image: "https://res.cloudinary.com/douw1swxz/image/upload/v1782358151/j-perfume-products/nor9mfnvkoke1hvk0dvy.jpg",
    suitableSkinTypes: ["all"], occasions: ["office", "evening"],
  },
  {
    id: 3, name: "Royal Oud", price: 6500, gender: "Unisex",
    fragranceFamily: "Oud", category: "unisex", collection: "royal-oud",
    topNotes: ["Saffron", "Cardamom", "Rose"],
    heartNotes: ["Agarwood Oud", "Patchouli", "Incense"],
    baseNotes: ["Amber", "Sandalwood", "Musk"],
    description: "Regal pure agarwood oud. Royal occasions and evenings.",
    slug: "royal-oud", image: "https://res.cloudinary.com/douw1swxz/image/upload/v1782358151/j-perfume-products/dtucliblwytxyzdjdusu.jpg",
    suitableSkinTypes: ["all"], occasions: ["evening", "special"],
  },
  {
    id: 5, name: "Saffron Royale", price: 5800, gender: "Unisex",
    fragranceFamily: "Oriental", category: "unisex", collection: "royal-oud",
    topNotes: ["Saffron", "Cardamom", "Ginger"],
    heartNotes: ["Rose", "Oud", "Cedarwood"],
    baseNotes: ["Amber", "Musk", "Vanilla"],
    description: "Opulent Middle Eastern spice market. Special occasions and evenings.",
    slug: "saffron-royale", image: "https://res.cloudinary.com/douw1swxz/image/upload/v1782358152/j-perfume-products/iav61zwyz3nsv4jgr5zl.jpg",
    suitableSkinTypes: ["dry", "normal"], occasions: ["evening", "special"],
  },
  {
    id: 2, name: "Velour Rose", price: 3800, gender: "Women",
    fragranceFamily: "Floral", category: "women", collection: "pour-femme",
    topNotes: ["Pink Pepper", "Raspberry", "Bergamot"],
    heartNotes: ["Rose de Mai", "Jasmine", "Peony"],
    baseNotes: ["Musk", "Sandalwood", "Patchouli"],
    description: "Romantic, lush rose and musk. Daily wear to special occasions.",
    slug: "velour-rose", image: "https://res.cloudinary.com/douw1swxz/image/upload/v1782358153/j-perfume-products/ejjqrtieopjhwuttvtdu.jpg",
    suitableSkinTypes: ["all"], occasions: ["daily", "office", "evening", "special"],
  },
];

const GROK_SYSTEM_PROMPT = `You are "J-Fragrance AI", a warm, knowledgeable luxury fragrance advisor for J Perfumewala.
Your role is to help users find their perfect perfume through a friendly conversation.

IMPORTANT RULES:
- Ask questions ONE AT A TIME, never multiple questions together.
- Be warm, friendly, and use emojis sparingly.
- Check the conversation history to see what details the user has already provided.
- Do not repeat questions that the user has already answered.
- After collecting all info (skin type, gender, fragrance preferences, occasion), recommend 2-3 products from the catalog ONLY.
- Never recommend products outside the catalog.
- Always respond with valid JSON.

PRODUCT CATALOG:
${JSON.stringify(PRODUCT_CATALOG.map(p => ({
  id: p.id,
  name: p.name,
  gender: p.gender,
  family: p.fragranceFamily,
  skin: p.suitableSkinTypes,
  occasions: p.occasions,
  notes: [p.topNotes?.[0], p.heartNotes?.[0], p.baseNotes?.[0]].filter(Boolean)
})))}

CONVERSATION FLOW:
1. Greet warmly, introduce yourself as J-Fragrance AI, and ask for their skin type (oily/dry/combination/normal).
2. Ask about gender preference (Men/Women/Unisex).
3. Ask preferred fragrance family (Fresh/Floral/Woody/Oud/Oriental) OR if they have a perfume they already like.
4. Ask about occasion (daily wear/office/evening/special occasion).
5. After getting all details → give recommendations.

RESPONSE FORMAT — ALWAYS return valid JSON:

For regular conversation messages, you MUST identify what you are asking the user for next. The "nextStep" field should represent the next input you are waiting for:
- If you just asked about skin type (or are about to): "skin"
- If you just asked about gender preference: "gender"
- If you just asked about fragrance family / preference: "fragrance"
- If you just asked about occasion: "occasion"
- If you are about to recommend or are doing recommendations: "recommendations"

Format:
{"type": "message", "message": "Your friendly response here", "nextStep": "gender"}

For final recommendations (after collecting all 4 inputs):
{"type": "recommendations", "message": "Friendly summary of why these match them", "products": [id1, id2, id3], "nextStep": "recommendations"}

NEVER return plain text. ALWAYS return JSON.`;

// ============================================================
// CHAT ANALYTICS & PROGRAMMATIC MATCHING LOGIC
// ============================================================

function analyzeChatHistory(messages) {
  let skin = null;
  let gender = null;
  let fragrance = null;
  let occasion = null;

  messages.forEach(msg => {
    if (msg.role === 'user') {
      const content = msg.content.trim().toLowerCase();

      // Detect Skin Type
      if (/oily/i.test(content)) skin = 'oily';
      else if (/dry/i.test(content)) skin = 'dry';
      else if (/normal/i.test(content)) skin = 'normal';
      else if (/combination/i.test(content)) skin = 'combination';

      // Detect Gender (check women/femme/female first to avoid matching "men" inside "women")
      if (/women|femme|female/i.test(content)) gender = 'women';
      else if (/men|homme|male/i.test(content)) gender = 'men';
      else if (/unisex/i.test(content)) gender = 'unisex';

      // Detect Fragrance Family
      if (/fresh/i.test(content)) fragrance = 'fresh';
      else if (/floral/i.test(content)) fragrance = 'floral';
      else if (/woody|wood/i.test(content)) fragrance = 'woody';
      else if (/oud/i.test(content)) fragrance = 'oud';
      else if (/oriental/i.test(content)) fragrance = 'oriental';

      // Detect Occasion
      if (/daily|everyday/i.test(content)) occasion = 'daily';
      else if (/office|work/i.test(content)) occasion = 'office';
      else if (/evening|night/i.test(content)) occasion = 'evening';
      else if (/special|party|wedding/i.test(content)) occasion = 'special';
    }
  });

  return { skin, gender, fragrance, occasion };
}

function getScoredRecommendations({ skin, gender, fragrance, occasion }) {
  const scored = PRODUCT_CATALOG.map(product => {
    let score = 0;
    
    // Gender Match (strict filter: if specified, must match)
    let genderMatch = true;
    if (gender) {
      const pGender = product.gender.toLowerCase();
      if (gender === 'men' && pGender !== 'men' && pGender !== 'unisex') genderMatch = false;
      else if (gender === 'women' && pGender !== 'women' && pGender !== 'unisex') genderMatch = false;
      else if (gender === 'unisex' && pGender !== 'unisex') genderMatch = false;
    }
    if (genderMatch) score += 3;

    // Fragrance Family Match (essential)
    if (fragrance && product.fragranceFamily.toLowerCase() === fragrance) {
      score += 5;
    }

    // Occasion Match (important)
    if (occasion) {
      const pOccasion = product.occasions.map(o => o.toLowerCase());
      if (pOccasion.includes(occasion)) {
        score += 3;
      }
    }

    // Skin Type Match (good to have)
    if (skin) {
      const pSkin = product.suitableSkinTypes.map(s => s.toLowerCase());
      if (pSkin.includes('all') || pSkin.includes(skin)) {
        score += 2;
      }
    }

    return { product, score, genderMatch };
  });

  // Filter out products that don't match the gender at all
  const eligible = scored.filter(item => item.genderMatch);
  
  // Sort descending by score
  eligible.sort((a, b) => b.score - a.score);

  // Return the top 3 products
  return eligible.slice(0, 3).map(item => item.product.id);
}

function getProgrammaticResponse(messages) {
  const { skin, gender, fragrance, occasion } = analyzeChatHistory(messages);

  if (!skin) {
    return {
      type: "message",
      message: "What's your skin type? (Oily / Dry / Normal / Combination)",
      nextStep: "skin"
    };
  } else if (!gender) {
    return {
      type: "message",
      message: "Great! Who is this perfume for? (Men / Women / Unisex)",
      nextStep: "gender"
    };
  } else if (!fragrance) {
    return {
      type: "message",
      message: "Lovely choice. What fragrance family do you prefer? (Fresh / Floral / Woody / Oud / Oriental)",
      nextStep: "fragrance"
    };
  } else if (!occasion) {
    return {
      type: "message",
      message: "And when do you plan to wear it? (Daily Wear / Office / Evening / Special Occasion)",
      nextStep: "occasion"
    };
  } else {
    const recommendedIds = getScoredRecommendations({ skin, gender, fragrance, occasion });
    const cap = (val) => val ? val.charAt(0).toUpperCase() + val.slice(1) : "";
    return {
      type: "recommendations",
      message: `Based on your profile (Skin: ${cap(skin)}, Gender: ${cap(gender)}, Scent family: ${cap(fragrance)}, Occasion: ${cap(occasion)}), here are the best luxury fragrances from our catalog that match your preferences:`,
      products: recommendedIds,
      nextStep: "recommendations"
    };
  }
}

// Chat endpoint
app.post('/chat', async (req, res) => {
  try {
    const { messages } = req.body;

    if (!messages || !Array.isArray(messages)) {
      return res.status(400).json({ error: 'messages array is required' });
    }

    const { skin, gender, fragrance, occasion } = analyzeChatHistory(messages);
    let useFallback = false;
    let parsed;

    const GROK_API_KEY = process.env.Grok_API;
    if (!GROK_API_KEY) {
      console.log('Groq API key not configured. Using programmatic fallback.');
      useFallback = true;
    } else {
      try {
        const response = await fetch('https://api.groq.com/openai/v1/chat/completions', {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${GROK_API_KEY}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            model: 'llama-3.1-8b-instant',
            response_format: { type: "json_object" },
            messages: [
              { role: 'system', content: GROK_SYSTEM_PROMPT },
              ...messages,
            ],
            temperature: 0.7,
            max_tokens: 300,
          }),
        });

        if (!response.ok) {
          const errText = await response.text();
          console.error('Grok API error status:', response.status, errText);
          if (response.status === 429) {
            useFallback = true; // Use fallback on rate limit
          } else {
            return res.status(response.status).json({ error: 'Grok API request failed', details: errText });
          }
        } else {
          const data = await response.json();
          const rawContent = data.choices?.[0]?.message?.content || '';

          // Parse Grok's JSON response
          try {
            let jsonText = rawContent.trim();
            const jsonMatch = jsonText.match(/```(?:json)?\s*([\s\S]*?)```/);
            if (jsonMatch) {
              jsonText = jsonMatch[1].trim();
            }
            const startIdx = jsonText.indexOf('{');
            const endIdx = jsonText.lastIndexOf('}');
            if (startIdx !== -1 && endIdx !== -1 && endIdx > startIdx) {
              jsonText = jsonText.substring(startIdx, endIdx + 1);
            }
            parsed = JSON.parse(jsonText);
          } catch (parseError) {
            console.error('Failed to parse Grok JSON:', parseError, 'Raw content:', rawContent);
            parsed = { type: 'message', message: rawContent };
          }
        }
      } catch (err) {
        console.error('Grok API fetch error:', err.message);
        useFallback = true;
      }
    }

    if (useFallback) {
      parsed = getProgrammaticResponse(messages);
    }

    // Override or structure as recommendations when all 4 inputs are collected
    if (skin && gender && fragrance && occasion) {
      const recommendedProductIds = getScoredRecommendations({ skin, gender, fragrance, occasion });
      
      parsed.type = 'recommendations';
      parsed.products = recommendedProductIds;
      parsed.nextStep = 'recommendations';
      
      if (!parsed.message || parsed.message.length < 5) {
        const cap = (val) => val ? val.charAt(0).toUpperCase() + val.slice(1) : "";
        parsed.message = `Based on your analysis (Skin: ${cap(skin)}, Gender: ${cap(gender)}, Scent: ${cap(fragrance)}, Occasion: ${cap(occasion)}), here are the best luxury fragrances from our catalog that match your profile:`;
      }
    }

    res.json(parsed);

  } catch (error) {
    console.error('Chat endpoint error:', error);
    res.status(500).json({ error: 'Internal server error', message: error.message });
  }
});


app.listen(PORT, () => {
  console.log(`🚀 J Perfumewala Backend running on port ${PORT}`);
  console.log(`💳 Razorpay: ${process.env.RAZORPAY_KEY_ID ? '✅ Configured' : '⚠️  Mock mode (add RAZORPAY_KEY_ID & RAZORPAY_KEY_SECRET to .env)'}`);
  console.log(`🤖 Groq AI: ${process.env.Grok_API ? '✅ Configured (groq.com)' : '❌ Missing Grok_API in .env'}`);
});

