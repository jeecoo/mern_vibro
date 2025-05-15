import express from 'express';
import User from '../models/User.js';
import jwt from 'jsonwebtoken';
import mongoose from 'mongoose'; // Ensure this is at the top of your file

import { verifyToken } from '../middleware/authMiddleware.js'; 


const router = express.Router();

const generateToken = (userId) => {
    return jwt.sign({ userId }, process.env.JWT_SECRET, { expiresIn: '15d' });
}


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
        
        //get random avatar
        const profileImage = `https://api.dicebear.com/9.x/bottts/svg?seed=${username}`;
        
        const user = new User({
            email,
            username,
            password,
            profileImage,
        })

        await user.save();

        const token = generateToken(user._id);

        res.status(201).json({
            token,
            user:{
                _id: user._id,
                username: user.username,
                email: user.email,
                profileImage: user.profileImage,
            }
        });

    } catch (error) {
        console.log("Error in register route", error);
        res.status(500).json({ message: 'Server error' });
    }
});


router.post('/login', async (req, res) => {
    try {
        const { email, password } = req.body;
        console.log(email+password)
        if(!email || !password) return res.status(400).json({ message: "Please fill in all fields" });
        
        //check if user exists
        const user = await User.findOne({ email });
        if (!user) return res.status(400).json({ message: "Invalid credentials" });

        //check if password is correct
        const isPasswordMatch = await user.comparePassword(password);
        if (!isPasswordMatch) return res.status(400).json({ message: "Invalid credentials" });

        //generate token
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

export default router;