import express from 'express';
import Message from '../models/Messages.js';
import Group from '../models/Group.js';
import GroupUser from '../models/GroupUser.js';
import { verifyToken } from '../middleware/authMiddleware.js';
import { io } from '../index.js';
import mongoose from 'mongoose'; // Import mongoose for ObjectId casting

const router = express.Router();

// Send a message
router.post('/send', verifyToken, async (req, res) => {
  try {
    const { groupId, messageType, message, imageUrl } = req.body;
    // Use the same user ID property as in groupRoutes (assuming req.user.userId is correct)
    const senderId = req.user.userId; 

    console.log('Backend Send - Received Group ID:', groupId);
    console.log('Backend Send - Sender User ID:', senderId);


    if (!groupId || !messageType) {
      console.log('Backend Send - Missing groupId or messageType');
      return res.status(400).json({ message: "GroupId and messageType are required." });
    }
    if (messageType === 'text' && (!message || message.trim() === '')) {
      console.log('Backend Send - Missing text message content');
      return res.status(400).json({ message: "Message content is required for text type." });
    }
    if (messageType === 'image' && !imageUrl) {
      console.log('Backend Send - Missing image URL');
      return res.status(400).json({ message: "Image URL is required for image type." });
    }

    // Optional: Check if group exists (already done in membership check below, but can keep)
    const group = await Group.findById(groupId);
    if (!group) {
      console.log('Backend Send - Group not found for ID:', groupId);
      return res.status(404).json({ message: 'Group not found' });
    }

    // Check if the user is a member of the group using GroupUser model
    // Explicitly cast IDs to ObjectId for robustness
    const groupUser = await GroupUser.findOne({ 
      groupid: new mongoose.Types.ObjectId(groupId), 
      userid: new mongoose.Types.ObjectId(senderId) 
    });

    console.log('Backend Send - GroupUser findOne result:', groupUser);

    // FIX: Changed from !group to !groupUser
    if (!groupUser) {
      console.log('Backend Send - User is not a member for group/user:', groupId, senderId);
    return res.status(403).json({ message: 'User is not a member of this group' });
    }

    const newMessage = new Message({
      senderId, // Store as ObjectId
      groupId, // Store as ObjectId
      messageType,
      messageText: messageType === 'text' ? message.trim() : null, // Trim text message
      imageUrl: messageType === 'image' ? imageUrl : null,
    });

    await newMessage.save();

    // Populate sender details for the response and emission
    const populatedMessage = await Message.findById(newMessage._id)
      .populate('senderId', 'username profilePicture');

    if (!populatedMessage) {
      console.error('Backend Send - Failed to retrieve saved message after save');
      return res.status(500).json({ message: 'Failed to retrieve saved message for emission' });
    }

    // Emit message to the group's room
    // Ensure groupId is a string when emitting
    io.to(groupId.toString()).emit("newMessage", populatedMessage);

    res.status(201).json(populatedMessage);
  } catch (error) {
    console.error("Error sending message:", error);
    // Add more specific error logging if needed, e.g., casting errors
    if (error instanceof mongoose.Error.CastError) {
      console.error("Backend Send - Cast Error:", error.message);
      return res.status(400).json({ message: 'Invalid Group ID or User ID format', error: error.message });
    }
    res.status(500).json({ message: 'Failed to send message', error: error.message });
  }
});

// Get all messages for a specific group
router.get('/:groupId', verifyToken, async (req, res) => {
  try {
  // Use the same user ID property as in groupRoutes
    const currentUserId = req.user.userId; 
    const { groupId } = req.params;

  const { limit = 20, beforeId } = req.query; // Default limit to 20

    // Log the exact values received on the backend (Keep these logs!)
    console.log('Backend Fetch - Received Group ID:', groupId);
    console.log('Backend Fetch - User ID from Token:', currentUserId);
    // Check if group exists (optional, membership check covers this)
    const group = await Group.findById(groupId);
    if (!group) {
      console.log('Backend Fetch - Group not found for ID:', groupId);
      return res.status(404).json({ message: 'Group not found' });
    }

    // Check if the user is a member of the group using GroupUser model
    // Explicitly cast IDs to ObjectId for robustness
    const groupUser = await GroupUser.findOne({ 
      groupid: new mongoose.Types.ObjectId(groupId), 
      userid: new mongoose.Types.ObjectId(currentUserId) 
    });

    // Log the result of the query (Keep these logs!)
    console.log('Backend Fetch - GroupUser findOne result:', groupUser);

    if (!groupUser) {
      console.log('Backend Fetch - GroupUser entry not found for group/user:', groupId, currentUserId);
      return res.status(403).json({ message: 'User is not a member of this group' });
    }

    // Fetch messages for the group, ordered by creation date
    const messages = await Message.find({ groupId: new mongoose.Types.ObjectId(groupId) })
      .populate('senderId', 'username profilePicture') // Populate sender details
      .sort({ createdAt: 1 }); // Sort ascending by creation date

    console.log(`Backend Fetch - Found ${messages.length} messages for group ${groupId}`);

    res.status(200).json(messages);
  } catch (error) {
    console.error("Error fetching messages (backend):", error);
    
    // Handle potential CastError if ObjectId is invalid
    if (error instanceof mongoose.Error.CastError) {
      console.error("Backend Fetch - Cast Error:", error.message);
      return res.status(400).json({ message: 'Invalid Group ID or User ID format', error: error.message });
    }

    res.status(500).json({ message: 'Failed to fetch messages', error: error.message });
  }
});

// Get messages from a specific user in a group
router.get('/:groupId/user/:userId', verifyToken, async (req, res) => {
  try {
    // Use the same user ID property as in groupRoutes
    const currentUserId = req.user.userId; 
    const { groupId, userId } = req.params; // userId here is the ID of the sender you want messages FROM

    console.log('Backend Fetch User Specific - Received Group ID:', groupId);
    console.log('Backend Fetch User Specific - Target User ID (sender):', userId);
    console.log('Backend Fetch User Specific - User ID from Token (current user):', currentUserId);


    const group = await Group.findById(groupId);
    if (!group) {
      console.log('Backend Fetch User Specific - Group not found for ID:', groupId);
      return res.status(404).json({ message: 'Group not found' });
    }

    // Check if the current user is a member of the group using GroupUser model
    // Explicitly cast IDs to ObjectId for robustness
    const groupUser = await GroupUser.findOne({ 
      groupid: new mongoose.Types.ObjectId(groupId), 
      userid: new mongoose.Types.ObjectId(currentUserId) 
    });

    console.log('Backend Fetch User Specific - GroupUser findOne result:', groupUser);


    if (!groupUser) {
      console.log('Backend Fetch User Specific - User is not a member for group/user:', groupId, currentUserId);
      return res.status(403).json({ message: 'You are not a member of this group' });
    }

    // Fetch messages from the specific sender within the group
    // Explicitly cast IDs to ObjectId for robustness
    const messages = await Message.find({ 
      groupId: new mongoose.Types.ObjectId(groupId), 
      senderId: new mongoose.Types.ObjectId(userId) 
    })
      .populate('senderId', 'username profilePicture') // Populate sender details
      .sort({ createdAt: 1 }); // Sort ascending by creation date

    console.log(`Backend Fetch User Specific - Found ${messages.length} messages for user ${userId} in group ${groupId}`);


    res.status(200).json(messages);
  } catch (error) {
    console.error("Error fetching user-specific messages in group:", error);
    // Handle potential CastError if ObjectId is invalid
    if (error instanceof mongoose.Error.CastError) {
      console.error("Backend Fetch User Specific - Cast Error:", error.message);
      return res.status(400).json({ message: 'Invalid Group ID or User ID format', error: error.message });
    }
    res.status(500).json({ message: 'Failed to fetch messages', error: error.message });
  }
});

export default router;