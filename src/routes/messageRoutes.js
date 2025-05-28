import express from 'express';
import Message from '../models/Messages.js';
import Group from '../models/Group.js';
import GroupUser from '../models/GroupUser.js';
import { verifyToken } from '../middleware/authMiddleware.js';
import { io } from '../index.js';
import mongoose from 'mongoose';
import crypto from 'crypto';

const router = express.Router();



const algorithm = 'aes-256-cbc';
const ivLength = 16; 

function getKeyFromGroupId(groupId) {
  return crypto.createHash('sha256').update(groupId).digest();
}

function encryptText(text, groupId) {
  const iv = crypto.randomBytes(ivLength);
  const key = getKeyFromGroupId(groupId);
  const cipher = crypto.createCipheriv(algorithm, key, iv);
  let encrypted = cipher.update(text, 'utf8', 'base64');
  encrypted += cipher.final('base64');
  return {
    iv: iv.toString('base64'),
    encryptedData: encrypted,
  };
}

function decryptText(encryptedData, iv, groupId) {
  if (!iv || Buffer.from(iv, 'base64').length !== ivLength) {
    throw new Error("Invalid or missing IV");
  }
  const key = getKeyFromGroupId(groupId);
  const decipher = crypto.createDecipheriv(algorithm, key, Buffer.from(iv, 'base64'));
  let decrypted = decipher.update(encryptedData, 'base64', 'utf8');
  decrypted += decipher.final('utf8');
  return decrypted;
}



router.post('/send', verifyToken, async (req, res) => {
  try {
    const { groupId, messageType, message, imageUrl } = req.body;
    const senderId = req.user.userId;

    if (!groupId || !messageType)
      return res.status(400).json({ message: "GroupId and messageType are required." });

    if (messageType === 'text' && (!message || message.trim() === ''))
      return res.status(400).json({ message: "Message content is required for text type." });

    if (messageType === 'image' && !imageUrl)
      return res.status(400).json({ message: "Image URL is required for image type." });

    const group = await Group.findById(groupId);
    if (!group) return res.status(404).json({ message: 'Group not found' });

    const groupUser = await GroupUser.findOne({
      groupid: new mongoose.Types.ObjectId(groupId),
      userid: new mongoose.Types.ObjectId(senderId),
    });
    if (!groupUser) return res.status(403).json({ message: 'User is not a member of this group' });

    let encryptedText = null;
    let iv = null;

    if (messageType === 'text') {
      const encrypted = encryptText(message.trim(), groupId);
      encryptedText = encrypted.encryptedData;
      iv = encrypted.iv;
    }

    const newMessage = new Message({
      senderId,
      groupId,
      messageType,
      messageText: encryptedText,
      imageUrl: messageType === 'image' ? imageUrl : null,
      iv: iv || null,
    });

    await newMessage.save();

    const populatedMessage = await Message.findById(newMessage._id).populate('senderId', 'username profilePicture');

    if (populatedMessage.messageType === 'text' && populatedMessage.iv) {
      try {
        populatedMessage.messageText = decryptText(populatedMessage.messageText, populatedMessage.iv, groupId);
      } catch {
        populatedMessage.messageText = '[Decryption Failed]';
      }
    }

    io.to(groupId.toString()).emit("newMessage", populatedMessage);

    res.status(201).json(populatedMessage);
  } catch (error) {
    console.error("Error sending message:", error);
    if (error instanceof mongoose.Error.CastError) {
      return res.status(400).json({ message: 'Invalid ID format', error: error.message });
    }
    res.status(500).json({ message: 'Failed to send message', error: error.message });
  }
});



router.get('/:groupId', verifyToken, async (req, res) => {
  try {
    const currentUserId = req.user.userId;
    const { groupId } = req.params;

    const group = await Group.findById(groupId);
    if (!group) return res.status(404).json({ message: 'Group not found' });

    const groupUser = await GroupUser.findOne({
      groupid: new mongoose.Types.ObjectId(groupId),
      userid: new mongoose.Types.ObjectId(currentUserId),
    });
    if (!groupUser) return res.status(403).json({ message: 'User is not a member of this group' });

    const messages = await Message.find({ groupId: new mongoose.Types.ObjectId(groupId) })
      .populate('senderId', 'username profilePicture')
      .sort({ createdAt: 1 });

    const decryptedMessages = messages.map(msg => {
      if (msg.messageType === 'text' && msg.iv) {
        try {
          msg.messageText = decryptText(msg.messageText, msg.iv, groupId);
        } catch {
          msg.messageText = '[Decryption Failed]';
        }
      }
      return msg;
    });

    res.status(200).json(decryptedMessages);
  } catch (error) {
    console.error("Error fetching messages:", error);
    if (error instanceof mongoose.Error.CastError) {
      return res.status(400).json({ message: 'Invalid Group ID format', error: error.message });
    }
    res.status(500).json({ message: 'Failed to fetch messages', error: error.message });
  }
});



router.get('/:groupId/user/:userId', verifyToken, async (req, res) => {
  try {
    const currentUserId = req.user.userId;
    const { groupId, userId } = req.params;

    const group = await Group.findById(groupId);
    if (!group) return res.status(404).json({ message: 'Group not found' });

    const groupUser = await GroupUser.findOne({
      groupid: new mongoose.Types.ObjectId(groupId),
      userid: new mongoose.Types.ObjectId(currentUserId),
    });
    if (!groupUser) return res.status(403).json({ message: 'You are not a member of this group' });

    const messages = await Message.find({
      groupId: new mongoose.Types.ObjectId(groupId),
      senderId: new mongoose.Types.ObjectId(userId),
    })
      .populate('senderId', 'username profilePicture')
      .sort({ createdAt: 1 });

    const decryptedMessages = messages.map(msg => {
      if (msg.messageType === 'text' && msg.iv) {
        try {
          msg.messageText = decryptText(msg.messageText, msg.iv, groupId);
        } catch {
          msg.messageText = '[Decryption Failed]';
        }
      }
      return msg;
    });

    res.status(200).json(decryptedMessages);
  } catch (error) {
    console.error("Error fetching user-specific messages:", error);
    if (error instanceof mongoose.Error.CastError) {
      return res.status(400).json({ message: 'Invalid ID format', error: error.message });
    }
    res.status(500).json({ message: 'Failed to fetch messages', error: error.message });
  }
});

export default router;
