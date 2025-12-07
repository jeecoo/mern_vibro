import express from 'express';
import User from '../models/User.js';
import Group from '../models/Group.js';
import CustomFolder from '../models/CustomFolder.js';
import CustomSound from '../models/CustomSound.js';
import jwt from 'jsonwebtoken';
import mongoose from 'mongoose'; // Ensure this is at the top of your file
import multer from 'multer'; // For handling file uploads
import path from 'path'; // For path manipulation

import { verifyToken } from '../middleware/authMiddleware.js';

const router = express.Router();

const generateToken = (userId) => {
  return jwt.sign({ userId }, process.env.JWT_SECRET, { expiresIn: '15d' });
}

// --- Folder Endpoints ---

router.post('/addFolder', verifyToken, async (req, res) => {
  try {
    const { folderName, groupId } = req.body;
    const createdBy = req.userId; // From verifyToken middleware

    if (!mongoose.Types.ObjectId.isValid(groupId)) {
      return res.status(400).json({ message: 'Invalid groupId' });
    }
 
    const groupExists = await Group.findById(groupId);
    if (!groupExists) {
      return res.status(404).json({ message: 'Group not found' });
    }

    const newFolder = new CustomFolder({
      folderName,
      groupId,
      createdBy,
    });

    const savedFolder = await newFolder.save();
    res.status(201).json(savedFolder);
  } catch (error) {
    console.error('Error adding folder:', error);
    res.status(500).json({ message: 'Failed to add folder' });
  }
});

router.put('/removeFolder', verifyToken, async (req, res) => {
  try {
    const { folderId } = req.body;
  
    if (!mongoose.Types.ObjectId.isValid(folderId)) {
      return res.status(400).json({ message: 'Invalid folderId' });
    }

    const folder = await CustomFolder.findById(folderId);
    if (!folder) {
      return res.status(404).json({ message: 'Folder not found' });
    }

    // Optionally, you can add a check to ensure only the creator or admin can remove
    if (folder.createdBy.toString() !== req.userId) {
      return res.status(403).json({ message: 'Unauthorized to remove this folder' });
    }

    // Also, consider removing associated sounds in this folder
    await CustomSound.deleteMany({ folderId });

    const deletedFolder = await CustomFolder.findByIdAndDelete(folderId);

    if (deletedFolder) {
      res.json({ message: 'Folder removed successfully' });
    } else {
      res.status(404).json({ message: 'Folder not found' });
    }
  } catch (error) {
    console.error('Error removing folder:', error);
    res.status(500).json({ message: 'Failed to remove folder' });
  }
});

// --- Sound Endpoints ---

// Configure multer for handling file uploads

router.post('/addSound', verifyToken, async (req, res) => {
  try {
    const { groupId, userId, folderId, filename, sound } = req.body;

    if (!mongoose.Types.ObjectId.isValid(groupId)) {
      return res.status(400).json({ message: 'Invalid groupId' });
    }
    if (!mongoose.Types.ObjectId.isValid(userId)) {
      return res.status(400).json({ message: 'Invalid userId' });
    }
    if (folderId && !mongoose.Types.ObjectId.isValid(folderId)) {
      return res.status(400).json({ message: 'Invalid folderId' });
    }

    const groupExists = await Group.findById(groupId);
    if (!groupExists) {
      return res.status(404).json({ message: 'Group not found' });
    }

    const userExists = await User.findById(userId);
    if (!userExists) {
      return res.status(404).json({ message: 'User not found' });
    }

    const folderExists = folderId ? await CustomFolder.findById(folderId) : null;
    if (folderId && !folderExists) {
      return res.status(404).json({ message: 'Folder not found' });
    }

    if (!sound) {
      return res.status(400).json({ message: 'Sound file is required' });
    }

    const newSound = new CustomSound({
      groupId,
      userId,
      folderId,
      sound,
      filename: filename || req.file.originalname,
      // You might want to determine the actual MIME type based on the file content
      // or rely on the client to provide it.
    });

    const savedSound = await newSound.save();
    res.status(201).json(savedSound);
  } catch (error) {
    console.error('Error adding sound:', error);
    res.status(500).json({ message: 'Failed to add sound' });
  }
});

router.put('/removeSound', verifyToken, async (req, res) => {
  try {
    const { soundId } = req.body;

    if (!mongoose.Types.ObjectId.isValid(soundId)) {
      return res.status(400).json({ message: 'Invalid soundId' });
    }

    const sound = await CustomSound.findById(soundId);
    if (!sound) {
      return res.status(404).json({ message: 'Sound not found' });
    }

    // Optionally, ensure only the creator or admin can remove
    if (sound.userId.toString() !== req.userId) {
      return res.status(403).json({ message: 'Unauthorized to remove this sound' });
    }

    const deletedSound = await CustomSound.findByIdAndDelete(soundId);

    if (deletedSound) {
      res.json({ message: 'Sound removed successfully' });
    } else {
      res.status(404).json({ message: 'Sound not found' });
    }
  } catch (error) {
    console.error('Error removing sound:', error);
    res.status(500).json({ message: 'Failed to remove sound' });
  }
});


router.get('/folders/:groupId', async (req, res) => {
  try {
    const { groupId } = req.params;

    if (!mongoose.Types.ObjectId.isValid(groupId)) {
      return res.status(400).json({ message: 'Invalid groupId' });
    }

    const groupExists = await Group.findById(groupId);
    if (!groupExists) {
      return res.status(404).json({ message: 'Group not found' });
    }

    // Find all folders for the given group, populating the createdBy field.
    const folders = await CustomFolder.find({ groupId: groupId }).populate('createdBy', 'username');
    console.log('Fetched Folders:', folders.map(f => ({ _id: f._id, folderName: f.folderName })));

    res.json({ folders });
  } catch (error) {
    console.error('Error fetching folders:', error);
    res.status(500).json({ message: 'Failed to fetch folders' });
  }
});

router.get('/sounds/:folderId', async (req, res) => {
  try {
    const { folderId } = req.params;

    if (!mongoose.Types.ObjectId.isValid(folderId)) {
      return res.status(400).json({ message: 'Invalid folderId' });
    }

    //  No need to check for group existence here, unless you have a specific business
    //  rule that requires it.  We're directly querying based on folderId.

    // Find all sounds for the given folderId, excluding the 'sound' field.
    const sounds = await CustomSound.find({ folderId: folderId })
      .select('-sound') 
      .populate('userId', 'username')
      .populate('folderId', 'folderName'); //  Populate folderName

    console.log('Fetched Sounds for folder:', sounds.map(s => ({ _id: s._id, filename: s.filename, folderId: s.folderId })));

    res.json({ sounds });
  } catch (error) {
    console.error('Error fetching sounds by folderId:', error);
    res.status(500).json({ message: 'Failed to fetch sounds by folder' });
  }
});
router.get('/sound/:soundId', async (req, res) => {
  try {
    const { soundId } = req.params;

    if (!mongoose.Types.ObjectId.isValid(soundId)) {
      return res.status(400).json({ message: 'Invalid folderId' });
    }

    //  No need to check for group existence here, unless you have a specific business
    //  rule that requires it.  We're directly querying based on folderId.

    // Find all sounds for the given folderId, excluding the 'sound' field.
    const sound = await CustomSound.findById(soundId);
    console.log('Fetched Sounds for folder:',sound );
    res.json({ sound });
  } catch (error) {
    console.error('Error fetching sounds by folderId:', error);
    res.status(500).json({ message: 'Failed to fetch sounds by folder' });
  }
});


export default router;