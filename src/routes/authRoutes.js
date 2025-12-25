import express from 'express';
import User from '../models/User.js';
import jwt from 'jsonwebtoken';
import mongoose from 'mongoose'; // Ensure this is at the top of your file

import { verifyToken } from '../middleware/authMiddleware.js'; 

import { sendEmail, generateOTP } from '../utils/sendEmail.js';


const router = express.Router();

const generateToken = (userId) => {
    return jwt.sign({ userId }, process.env.JWT_SECRET, { expiresIn: '15d' });
}


// **Temporary in-memory store for registration and OTP**
// In a real application, use a dedicated Mongoose model or Redis for better persistence and scalability.
const pendingRegistrations = {}; // { email: { username, password, otp, expiry } }
const OTP_EXPIRY_MINUTES = 5;


router.post('/register', async (req, res) => {
    try {
        const { email,username, password } = req.body;

        if(!username ||!email || !password) {
            return res.status(400).json({ message: 'Please fill in all fields' });
        }

        if(password.length < 6) {
            return res.status(400).json({ message: 'Password must be at least 6 characters' });
        }

        if(username.length < 3) {
            return res.status(400).json({ message: 'Username must be at least 3 characters' });
        }

        // Check if user already exists
        const existingEmail = await User.findOne({ email });
        if (existingEmail) return res.status(400).json({ message: 'Email already exists ' });

        const existingUser = await User.findOne({ username });
        if (existingUser) return res.status(400).json({ message: 'Username already exists ' });
        

        // --- OTP Generation and Email Sending ---
        const otp = generateOTP();
        const expiry = Date.now() + (OTP_EXPIRY_MINUTES * 60 * 1000); // 5 minutes from now
        
        // Store details temporarily
        pendingRegistrations[email] = {
            username,
            password,
            otp,
            expiry,
            profileImage: `https://api.dicebear.com/9.x/bottts/svg?seed=${username}`
        };

        const subject = 'Your Registration Verification Code'; // Assume subject and text are defined or imported
        const text = `Your OTP is ${otp}`;
        // //get random avatar
        // const profileImage = `https://api.dicebear.com/9.x/bottts/svg?seed=${username}`;

        // Send the email (handle potential failure of sendEmail)
        await sendEmail(email, subject, text);

        res.status(202).json({ 
            message: `OTP sent to ${email}. Please verify to complete registration.`,
            // Optional: return expiry time to the client
            otpExpiry: expiry 
        });
        
        // const user = new User({
        //     email,
        //     username,
        //     password,
        //     profileImage,
        // })

        // await user.save();

        // const token = generateToken(user._id);

        // res.status(201).json({
        //     token,
        //     user:{
        //         _id: user._id,
        //         username: user.username,
        //         email: user.email,
        //         profileImage: user.profileImage,
        //     }
        // });

    } catch (error) {
        console.error("Error in register route (send OTP):", error);
        // Important: If email sending fails, clear the pending registration
        if (pendingRegistrations[req.body.email]) {
             delete pendingRegistrations[req.body.email];
        }
        res.status(500).json({ message: 'Server error: Could not send verification email.' });
    }
});

router.post('/verify-otp', async (req, res) => {
    try {
        const { email, otp } = req.body;
        // ... (Input validation and pending data retrieval)
        
        const registrationData = pendingRegistrations[email];

        // 1. Check if we have pending data for this email
        if (!registrationData) {
            return res.status(400).json({ message: 'No pending registration found or session expired.' });
        }

        // 2. Check for OTP expiry
        if (Date.now() > registrationData.expiry) {
            delete pendingRegistrations[email]; // Clean up expired data
            return res.status(400).json({ message: 'OTP has expired. Please try registering again.' });
        }

        // 3. Check if OTP matches
        if (otp !== registrationData.otp) {
            return res.status(400).json({ message: 'Invalid OTP.' });
        }

        // --- OTP Valid: Finalize Registration (User Creation) ---
        
        const { username, password, profileImage } = registrationData;

        // Ensure user does not already exist
        if (await User.findOne({ email })) {
             delete pendingRegistrations[email];
             return res.status(400).json({ message: 'User already verified and exists.' });
        }

        const user = new User({
            email,
            username,
            password, 
            profileImage,
        });

        await user.save(); 
        
        // Clean up the temporary store
        delete pendingRegistrations[email]; 

        // const token = generateToken(user._id);

        // This is the correct, single response.
       return res.status(201).json({
            message: 'Account successfully verified. Please log in.',
            // Remove token and user object completely from the response
        });

    } catch (error) {
        console.error("Error in verify-otp route:", error);
        res.status(500).json({ message: 'Server error during user creation.' });
    }
});




router.post('/login', async (req, res) => {
    try {
        const { email, password,fcmId } = req.body;
        console.log(email+password)
        if(!email || !password) return res.status(400).json({ message: "Please fill in all fields" });
        
        //check if user exists
        const user = await User.findOne({ email });
        if (!user) return res.status(400).json({ message: "Invalid credentials" });

        //check if password is correct
        const isPasswordMatch = await user.comparePassword(password);
        if (!isPasswordMatch) return res.status(400).json({ message: "Invalid credentials" });

        //generate token
           if (fcmId && user.fcmId !== fcmId) {
            user.fcmId = fcmId;
            await user.save();
            }
        const token = generateToken(user._id);

        res.status(200).json({
            token,
            user:{
                _id: user._id,
                username: user.username,
                email: user.email,
                profileImage: user.profileImage,
            }
        });

    } catch (error) {
        console.log("Error in login route", error);
        res.status(500).json({ message: 'Server error' });
    }
});

// Update User Profile
router.put('/update', verifyToken, async (req, res) => {
    try {
        const userId = req.user.userId; // Get user ID from the middleware
        const { username } = req.body; // Only allow updating username for now

        if (!username) {
            return res.status(400).json({ message: 'Please provide a username' });
        }
        if (username.length < 3) {
             return res.status(400).json({ message: 'Username must be at least 3 characters' });
        }

        // Find and update the user
        const updatedUser = await User.findByIdAndUpdate(
            userId,
            { username }, 
            { new: true, runValidators: true } 
        ).select('-password'); 

        if (!updatedUser) {
            return res.status(404).json({ message: 'User not found' }); 
        }

        res.status(200).json({
            user: updatedUser,
            message: 'Profile updated successfully'
        });

    } catch (error) {
        console.error("Error in update route:", error);
        res.status(500).json({ message: 'Server error', error: error.message });
    }
});



router.put('/set-active', verifyToken, async (req, res) => {
  try {
    const userId = req.user.userId;
    const { isActive } = req.body;

    if (typeof isActive !== 'boolean') {
      return res.status(400).json({ message: '`isActive` must be boolean' });
    }

    const updatedUser = await User.findByIdAndUpdate(
      userId,
      { isActive },
      { new: true, runValidators: true }
    ).select('-password');

    if (!updatedUser) {
      return res.status(404).json({ message: 'User not found' });
    }

    res.status(200).json({
      user: updatedUser,
      message: `User isActive status set to ${isActive}`,
    });
  } catch (error) {
    console.error("Error in set-active route:", error);
    res.status(500).json({ message: 'Server error', error: error.message });
  }
});

export default router;