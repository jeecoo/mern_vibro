// routes/detectedSound.js
import express from 'express';
import DetectedSound from '../models/DetectedSound.js';
import { verifyToken } from '../middleware/authMiddleware.js';

const router = express.Router();

// POST /api/sounds/add - Add a detected sound
router.post('/add', verifyToken, async (req, res) => {
    try {
        const { label, confidence } = req.body;
        const userId = req.user.userId;

        if (!label || !confidence) {
            return res.status(400).json({ message: 'Label and confidence are required.' });
        }

        const sound = new DetectedSound({
            userid: userId,
            label,
            confidence,
        });

        await sound.save();
        res.status(201).json({ sound, message: 'Detected sound saved successfully.' });
    } catch (error) {
        console.error('Error saving detected sound:', error);
        res.status(500).json({ message: 'Server error while saving detected sound', error: error.message });
    }
});

// GET /api/sounds/user - Get detected sounds by user ID (from token)
router.get('/:userId', verifyToken, async (req, res) => {
    try {
        //user id from another user dili imo or nako basin if nimo kay ako nya vice versa
        const { userId } = req.params;

        
        const sounds = await DetectedSound.find({ userid: userId }).sort({ createdAt: -1 });

        res.status(200).json({ sounds });
    } catch (error) {
        console.error('Error fetching detected sounds:', error);
        res.status(500).json({ message: 'Server error while fetching detected sounds', error: error.message });
    }
});

export default router;
