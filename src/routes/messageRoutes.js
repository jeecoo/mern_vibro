// routes/messageRoutes.js
import express from 'express';
import Message from '../models/Message.js';
import { verifyToken } from '../middleware/verifyToken.js'; 

const router = express.Router();

router.post('/send', verifyToken, async (req, res) => {
    try {
        const { groupId, messageType, message, imageUrl } = req.body;
        const senderId = req.user._id;

        // Optional: Check if the sender is actually a member of the group
        const group = await Group.findById(groupId);
        if (!group) return res.status(404).json({ message: 'Group not found' });
        if (!group.members.includes(senderId)) return res.status(403).json({ message: 'Not a member of this group' });

        const newMessage = new Message({
            senderId,
            groupId,
            messageType,
            message,
            imageUrl,
        });

        await newMessage.save();

        // TODO: Emit message via Socket.IO

        res.status(201).json(newMessage);
    } catch (error) {
        console.error("Error sending message:", error);
        res.status(500).json({ message: 'Failed to send message', error: error.message });
    }
});

router.get('/:groupId', verifyToken, async (req, res) => {
    try {
        const currentUserId = req.user._id;
        const groupId = req.params.groupId;

        // Optional: Check if the current user is a member of the group
        const group = await Group.findById(groupId);
        if (!group) return res.status(404).json({ message: 'Group not found' });
        if (!group.members.includes(currentUserId)) return res.status(403).json({ message: 'Not a member of this group' });

        const messages = await Message.find({ groupId: groupId })
            .populate('senderId', 'username')
            .sort('createdAt');

        res.status(200).json(messages);
    } catch (error) {
        console.error("Error fetching messages:", error);
        res.status(500).json({ message: 'Failed to fetch messages', error: error.message });
    }
});

export default router;