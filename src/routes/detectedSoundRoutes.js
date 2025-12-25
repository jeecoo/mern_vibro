// routes/detectedSound.js
import express from 'express';
import DetectedSound from '../models/DetectedSound.js';
import { verifyToken } from '../middleware/authMiddleware.js';
import { io, socketGroups, userSockets } from '../index.js';
import User from '../models/User.js';
import Group from '../models/Group.js';
import admin from '../lib/firebaseAdmin.js';
import GroupUser from '../models/GroupUser.js';
const router = express.Router();

// POST /api/sounds/add - Add a detected sound
// router.post('/add', verifyToken, async (req, res) => {
//     try {
//         const { label, confidence, sound } = req.body;
//         const userId = req.user.userId;
//         console.log("Detected sound request received:", req.body);
//         if (!label || !confidence) {
//             return res.status(400).json({ message: 'Label and confidence are required.' });
//         }

//         const user = await User.findById(userId);
//         if (!user) return res.status(404).json({ message: "User not found" });

//         const newsound = new DetectedSound({
//             userid: userId,
//             label,
//             confidence,
//             sound,
//         });

//         await newsound.save();

//         const socketIds = userSockets.get(userId);
//         const emittedGroups = [];

//         if (socketIds) {
//             const notifiedGroups = new Set();
//             for (const socketId of socketIds) {
//                 const groupsForSocket = socketGroups.get(socketId);
//                 if (groupsForSocket) {
//                     for (const groupId of groupsForSocket) {
//                         if (!notifiedGroups.has(groupId)) {
//                             // Fetch group name
//                             const group = await Group.findById(groupId);
//                             const groupName = group ? group.groupName : null;

//                             // Emit with complete info
//                             io.to(groupId).emit("new-sound", {
//                                 userId,
//                                 username: user.username,
//                                 groupId,
//                                 groupName,
//                                 label,
//                                 confidence,
                          
//                             });

//                             notifiedGroups.add(groupId);
//                             emittedGroups.push({ groupId, groupName });
//                         }
//                     }
//                 }
//             }
//         }

//       res.status(201).json({
//     message: 'Detected sound saved and emitted successfully.',
//     sound: {
//         id: newsound._id,
//         userId,
//         username: user.username,
//         groups: emittedGroups,
//         label,
//         confidence,
 
//     }
// });
//     } catch (error) {
//         console.error('Error saving detected sound:', error);
//         res.status(500).json({ message: 'Server error while saving detected sound', error: error.message });
//     }
// });
router.post('/add', verifyToken, async (req, res) => {
  try {
    const { label, confidence, sound } = req.body;
    const userId = req.user.userId;

    if (!label || !confidence) {
      return res.status(400).json({ message: 'Label and confidence are required.' });
    }

    const user = await User.findById(userId);
    if (!user) return res.status(404).json({ message: 'User not found' });

    // 1️⃣ Save detected sound
    const newSound = await DetectedSound.create({
      userid: userId,
      label,
      confidence,
      sound,
    });
    // console.log('Detected sound saved:', newSound);

    // 2️⃣ Find groups where user belongs
    const groupUsers = await GroupUser.find({ userid: userId });

const notifiedTokens = new Set();

for (const gu of groupUsers) {
  // 1️⃣ Get group info
  const group = await Group.findById(gu.groupid);
  if (!group) continue;

  // 2️⃣ Get all members of this group
  const members = await GroupUser.find({ groupid: gu.groupid });

  for (const member of members) {
    if (member.userid.toString() === userId) continue;

    const userMember = await User.findById(member.userid);
    if (!userMember?.fcmId) continue;
    if (notifiedTokens.has(userMember.fcmId)) continue;

    const message = {
      token: userMember.fcmId,
      notification: {
        title: `🚨 Sound Detected from ${group.groupName}`,
        body: `${user.username}: ${label}`,
      },
      data: {
        type: 'SOUND',
        groupId: group._id.toString(),
        groupName: group.groupName,
        soundId: newSound._id.toString(),
      },
    };

    try {
      await admin.messaging().send(message);
      notifiedTokens.add(userMember.fcmId);
      console.log(`✅ FCM sent to ${userMember.username}`);
    } catch (err) {
      console.error('❌ FCM failed:', err.message);
    }
  }
}



    res.status(201).json({
      message: 'Detected sound saved and FCM notifications sent.',
      sound: {
        id: newSound._id,
        userId,
        username: user.username,
        label,
        confidence,
      },
    });

  } catch (error) {
    console.error('Error saving detected sound:', error);
    res.status(500).json({
      message: 'Server error while saving detected sound',
      error: error.message,
    });
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
