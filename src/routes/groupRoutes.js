import express from 'express';
import Group from '../models/Group.js'; // Assuming your Group model is here
import { verifyToken } from '../middleware/authMiddleware.js'; 
import mongoose from "mongoose";  // Ensure mongoose is imported
import User from '../models/User.js';
import GroupUser from '../models/GroupUser.js';

import jwt from 'jsonwebtoken';
const router = express.Router();


router.post('/createGroup', verifyToken, async (req, res) => {
    try {
        const { groupName, groupPhoto } = req.body;
        const createdByUserId = req.user.userId; // Get user ID from authenticated token

        if (!groupName || groupName.trim().length < 3) {
            return res.status(400).json({ message: 'Group name is required and must be at least 3 characters long.' });
        }

        // Check if the creator user exists (optional, but good practice)
        const creator = await User.findById(createdByUserId);
        if (!creator) {
            return res.status(404).json({ message: 'Creator user not found.' });
        }
        const gphoto = `https://api.dicebear.com/9.x/bottts/svg?seed=${groupName}`;

        const newGroup = new Group({
            groupName: groupName.trim(),
            groupPhoto: groupPhoto || gphoto, // Default avatar
            createdBy: createdByUserId,
            // members and admins will be set by the pre-save hook in your Group model
        });

        await newGroup.save();

        // Populate createdBy and members/admins fields for the response
        const populatedGroup = await Group.findById(newGroup._id)
            .populate('createdBy', 'username profileImage email')

        res.status(201).json({ group: populatedGroup, message: 'Group created successfully' });
        
        const groupUser = new GroupUser({
            userid: createdByUserId,
            isAdmin: true,
            groupid: newGroup._id
        });
        await groupUser.save();
        
        

    } catch (error) {
        console.error("Error creating group:", error);
        if (error.name === 'ValidationError') {
            return res.status(400).json({ message: error.message });
        }
        res.status(500).json({ message: 'Server error while creating group', error: error.message });
    }
});


router.get('/getGroups',verifyToken, async (req, res) => { 
    const userId = req.user.userId; // Get user ID from the middleware

    try {
        
        const groupUserLinks = await GroupUser.find({ userid: userId });
        const groupIds = groupUserLinks.map(link => link.groupid);

        // Step 2: Find all active groups the user belongs to
        const groups = await Group.find({ _id: { $in: groupIds }, isActive: true })
            .populate('createdBy', 'username profileImage email') // optional
            .sort({ createdAt: -1 });

        res.status(200).json({ groups });

    } catch (error) {
        console.error("Error fetching user's groups:", error);
        res.status(500).json({ message: 'Server error while fetching user groups', error: error.message });
    }
});

router.get('/getMembers/:groupId',verifyToken, async (req, res) => { // Removed verifyToken to make it public for simplicity
    const userId = req.user.userId; 
    const { groupId } = req.params; // Get the groupId from the URL parameters


    try {
        
        const groupUserLinks = await GroupUser.find({ groupid: new mongoose.Types.ObjectId(groupId) })
        .populate('userid', 'username profileImage email'); // Populate the 'userid' field with the required fields
    
        const userIds = groupUserLinks.map(link => link.userid);           // lowercase
        const users = await User.find({ _id: { $in: userIds } }).select('-password');
        res.status(200).json({ users });

    } catch (error) {
        console.error("Error fetching groups member:", error);
        res.status(500).json({ message: 'Server error while fetching user groups', error: error.message });
    }
});

// 3. Get a specific group by ID
// GET /api/groups/:groupId
// Public or Private
router.get('/:groupId',verifyToken, async (req, res) => { // Removed verifyToken to make it public for simplicity
    try {
        const group = await Group.findById(req.params.groupId)
            .populate('createdBy', 'username profileImage email'); // Creator info

        if (!group) {
            return res.status(404).json({ message: 'Group not found' });
        }
        if (!group.isActive) {
            res.status(200).json({ group });
        }

        res.status(200).json({ group });
    } catch (error) {
        console.error("Error fetching group by ID:", error);
        if (error.kind === 'ObjectId') {
            return res.status(404).json({ message: 'Group not found (invalid ID format)' });
        }
        res.status(500).json({ message: 'Server error while fetching group', error: error.message });
    }
});


router.put('/:groupId', verifyToken, async (req, res) => {
    try {
        const { groupName, groupPhoto, isActive } = req.body;
        const groupId = req.params.groupId;
        const userId = req.user.userId; // ID of the user making the request

        console.log("Updating group with ID:", groupId);
        console.log("User ID:", userId);
        console.log("Request Body:", req.body);

        const group = await Group.findById(groupId);

        if (!group) {
            return res.status(404).json({ message: 'Group not found' });
        }

        // --- Corrected Authorization Check using GroupUser ---
        const groupUser = await GroupUser.findOne({ groupid: groupId, userid: userId });

        // If the user is not found in GroupUser for this group, or they are not an admin
        if (!groupUser || !groupUser.isAdmin) {
             // Added check if the user is also the group creator as an alternative admin check
             // depending on your desired logic.
             // For now, strictly checking GroupUser isAdmin status.
             // If creator should always be admin: add || (group.createdBy && group.createdBy.equals(userId))
             // but your createGroup route already creates a GroupUser with isAdmin: true for the creator.
            return res.status(403).json({ message: 'User not authorized to update this group. Only admins can modify group settings.' });
        }
        // --- End of Corrected Authorization Check ---


        if (groupName !== undefined) {
            if (groupName.trim().length < 3) {
                return res.status(400).json({ message: 'Group name must be at least 3 characters long.' });
            }
            group.groupName = groupName.trim();
            console.log("New group name:", group.groupName);
        }
        if (groupPhoto !== undefined) {
            group.groupPhoto = groupPhoto;
            console.log("New group photo:", group.groupPhoto);
        }
        if (isActive !== undefined && typeof isActive === 'boolean') {
            group.isActive = isActive;
            console.log("Is active:", group.isActive);
        }

        console.log("Group object before save:", group);
        const updatedGroup = await group.save();
        console.log("Group object after save:", updatedGroup);

        // It's important to populate the related users for the response if the client needs them
        // However, since membership is handled by GroupUser, populating 'members'/'admins'
        // directly on Group might not reflect the GroupUser data unless your Group schema
        // is explicitly set up to manage these arrays AND they are kept in sync.
        // If you rely solely on GroupUser for membership/admin status, you might
        // adjust the response structure or fetch members/admins separately.
        // For consistency with other routes, keeping the populate calls assumes
        // your Group model *does* have these fields and they *are* synced,
        // which might be the part you need to verify in your Group model hooks/logic.

         const populatedGroup = await Group.findById(updatedGroup._id)
            .populate('createdBy', 'username profileImage email');


        res.status(200).json({ group: populatedGroup, message: 'Group updated successfully' });

    } catch (error) {
        console.error("Error updating group:", error);
        if (error.name === 'ValidationError') {
            return res.status(400).json({ message: error.message });
        }
         // Catch potential Mongoose cast errors for groupId if it's invalid
         if (error instanceof mongoose.CastError) {
             return res.status(400).json({ message: 'Invalid group ID format' });
         }
        res.status(500).json({ message: 'Server error while updating group', error: error.message });
    }
});

router.get('/getMembers/:groupId',verifyToken, async (req, res) => {
    // ... (previous logic to get groupId) ...
    const groupUserLinks = await GroupUser.find({ groupid: new mongoose.Types.ObjectId(groupId) })
    .populate('userid', 'username profileImage email'); // This is the correct place to populate user details via the join model

    // Process groupUserLinks to extract user info and admin status if needed
    const users = groupUserLinks.map(link => ({
        _id: link.userid._id,
        username: link.userid.username,
        profileImage: link.userid.profileImage,
        email: link.userid.email,
        isAdmin: link.isAdmin // You can include admin status here
    }));

    res.status(200).json({ users }); // Send the list of users
});

// 5. Delete a group
// DELETE /api/groups/:groupId
// Requires authentication and user to be an admin of the group (or creator)
// DELETE /api/groups/:groupId
router.delete('/:groupId', verifyToken, async (req, res) => {
  try {
    const groupId = req.params.groupId;
    const userId = req.user.userId;

    const group = await Group.findById(groupId);

    if (!group) {
      return res.status(404).json({ message: 'Group not found' });
    }

    // Authorization: admin or creator
    const isAdmin = group.admins?.includes(userId);
    const isCreator = group.createdBy?.equals(userId);

    if (!isAdmin && !isCreator) {
      return res.status(403).json({
        message: 'User not authorized to delete this group.'
      });
    }

    // ✅ DELETE ALL GroupUser LINKS FIRST
    await GroupUser.deleteMany({ groupid: groupId });

    // ✅ DELETE GROUP
    await Group.findByIdAndDelete(groupId);

    res.status(200).json({
      message: 'Group and all memberships deleted successfully',
      groupDeleted: true,
    });

  } catch (error) {
    console.error("Error deleting group:", error);
    res.status(500).json({
      message: 'Server error while deleting group',
      error: error.message
    });
  }
});



// --- Member Management ---

// 6. Add a member to a group
// POST /api/groups/:groupId/members
// Requires authentication, and the logged-in user should be an admin of the group
router.post('/:groupId/members', verifyToken, async (req, res) => {
    try {
        const { userIdToAdd } = req.body; // ID of the user to be added
        const groupId = req.params.groupId;
        const loggedInUserId = req.user.userId; // ID of the user performing the action

        if (!userIdToAdd) {
            return res.status(400).json({ message: 'User ID to add is required.' });
        }

        const group = await Group.findById(groupId);
        if (!group) {
            return res.status(404).json({ message: 'Group not found.' });
        }

        // Authorization: Check if the logged-in user is an admin of this group
        if (!group.admins.includes(loggedInUserId)) {
            return res.status(403).json({ message: 'User not authorized to add members to this group.' });
        }

        // Check if user to add exists
        const userToAdd = await User.findById(userIdToAdd);
        if (!userToAdd) {
            return res.status(404).json({ message: 'User to add not found.' });
        }

        // Check if user is already a member
        if (group.members.includes(userIdToAdd)) {
            return res.status(400).json({ message: 'User is already a member of this group.' });
        }

        group.members.push(userIdToAdd);
        await group.save();
        
        const populatedGroup = await Group.findById(groupId)
            .populate('members', 'username profileImage email')
            .populate('admins', 'username profileImage email')
            .populate('createdBy', 'username profileImage email');

        res.status(200).json({ group: populatedGroup, message: 'Member added successfully.' });

    } catch (error) {
        console.error("Error adding member to group:", error);
        res.status(500).json({ message: 'Server error while adding member.', error: error.message });
    }
});

// 7. Remove a member from a group
// DELETE /api/groups/:groupId/members/:memberId
// Requires authentication. Logged-in user must be an admin of the group OR the member being removed.
router.delete('/:groupId/members/:memberId', verifyToken, async (req, res) => {
    try {
        const { groupId, memberId } = req.params;
        const loggedInUserId = req.user.userId; // User making the request

        // --- Step 1: Find the GroupUser link for the member being removed ---
        const memberGroupUserLink = await GroupUser.findOne({
            groupid: groupId,
            userid: memberId
        });

        if (!memberGroupUserLink) {
            return res.status(404).json({ message: 'Member not found in this group.' });
        }

        // --- Step 2: Authorization Check ---
        // Find the GroupUser link for the user making the request (to check if they are an admin)
        const requestingUserGroupLink = await GroupUser.findOne({
            groupid: groupId,
            userid: loggedInUserId
        });

        const isAdmin = requestingUserGroupLink ? requestingUserGroupLink.isAdmin : false;
        const isRemovingSelf = loggedInUserId === memberId;

        // User must be an admin OR be removing themselves
        if (!isAdmin && !isRemovingSelf) {
            return res.status(403).json({ message: 'User not authorized to remove this member.' });

        }

        // --- Step 3: Handle edge case: Prevent removing the last admin ---
        // Count admins *before* removal using GroupUser
        const adminLinksBeforeRemoval = await GroupUser.find({ groupid: groupId, isAdmin: true });
        const isLastAdminBeingRemoved = adminLinksBeforeRemoval.length === 1 && adminLinksBeforeRemoval[0].userid.equals(memberId);

        // Get the Group document (still needed for creator check and potential isActive update)
        const group = await Group.findById(groupId);
         // Need group to exist for creator check
        if (!group) {
             // This case should ideally not happen if memberGroupUserLink exists,
             // but it's a safety check.
             return res.status(404).json({ message: 'Group associated with membership not found.' });
        }
        const isCreator = group.createdBy && group.createdBy.equals(memberId);


        // Count members *before* removal using GroupUser
        const memberLinksBeforeRemoval = await GroupUser.find({ groupid: groupId });
        const isLastMemberBeingRemoved = memberLinksBeforeRemoval.length === 1 && memberLinksBeforeRemoval[0].userid.equals(memberId);


        // If the member being removed is the creator, is an admin, is the last admin, and the last member
        if (isCreator && memberGroupUserLink.isAdmin && isLastAdminBeingRemoved && isLastMemberBeingRemoved) {
           return res.status(400).json({
            message: 'LAST_ADMIN_CANNOT_LEAVE',
            });

 }
         // Optional: Add logic here if an admin is removing the creator who is the *only* admin but *not* the last member.


        // --- Step 4: Delete the GroupUser document (This is the main action) ---
        await GroupUser.deleteOne({ _id: memberGroupUserLink._id });

        // --- Step 5: Check if the group is now empty and deactivate it (using GroupUser count) ---
        const remainingMemberLinks = await GroupUser.find({ groupid: groupId });

        if (remainingMemberLinks.length === 0) {
             group.isActive = false; // Deactivate the group
             await group.save(); // Save the change to the Group document
             // Optionally delete the group entirely if it becomes empty: await Group.findByIdAndDelete(groupId);
             // console.log(`Group ${groupId} is now empty and deactivated.`);
        } else {
            // Optional: If the removed member was the last admin (but not the creator/last member handled above)
            // and there are other members left, you might need logic here to assign a new admin.
            const remainingAdminLinks = await GroupUser.find({ groupid: groupId, isAdmin: true });
            if (memberGroupUserLink.isAdmin && remainingAdminLinks.length === 0) {
                console.warn(`Group ${groupId} is now without admins after member ${memberId} was removed.`);
                // Implement logic to select a new admin or notify users.
            }
        }


        // Success response
        res.status(200).json({ message: 'Member removed successfully.' });

    } catch (error) {
        console.error("Error removing member from group:", error);
        if (error instanceof mongoose.CastError) {
            return res.status(400).json({ message: 'Invalid ID format.' });
        }
        res.status(500).json({ message: 'Server error while removing member.', error: error.message });
    }
});




router.post('/:groupId/join', verifyToken, async (req, res) => {
    try {
        const groupId = req.params.groupId;
        const userId = req.user.userId; // The logged-in user

        const group = await Group.findById(groupId);
        if (!group) {
            return res.status(404).json({ message: 'Group not found.' });
        }

        // Check if user is already a member of the group
        const existingMembership = await GroupUser.findOne({ groupid: groupId, userid: userId });
        if (existingMembership) {
            return res.status(400).json({ message: 'You are already a member of this group.' });
        }

        // Create the relationship between the user and the group
        const groupUser = new GroupUser({
            groupid: groupId,
            userid: userId,
            isAdmin: false, // Default role is not admin
        });
        await groupUser.save();

        // Optionally, update the group's members list
        // group.members.push(userId);
        // await group.save();

        // Return the updated group with the new member
        // const populatedGroup = await Group.findById(groupId)
        //     .populate('members', 'username profileImage email')
        //     .populate('admins', 'username profileImage email')
        //     .populate('createdBy', 'username profileImage email');

        res.status(200).json({
             group: group, // Return the group object you already fetched
             message: 'Joined group successfully.'
         });
    } catch (error) {
        console.error("Error joining group:", error);
        res.status(500).json({ message: 'Server error while joining group', error: error.message });
    }
});


// --- CustomSound Endpoints (Revised contributions route to include all members) ---

router.get('/contributions/:groupId', verifyToken, async (req, res) => {
    try {
        const { groupId } = req.params;
        const userId = req.userId; // Authenticated user ID
        console.log("Fetching contributions for groupId:", groupId, "by userId:", userId);

        if (!mongoose.Types.ObjectId.isValid(groupId)) {
            return res.status(400).json({ message: 'Invalid groupId' });
        }

        // SECURITY CHECK: Ensure the requesting user is a member of the group.
        const isMember = await GroupUser.findOne({
            groupid: groupId,
            userid: userId,
        });

        if (!isMember) {
            return res.status(403).json({ message: 'User is not a member of this group or group not found.' });
        }
        
        // Aggregation to count contributions per user
        const contributions = await GroupUser.aggregate([
            { $match: { groupid: new mongoose.Types.ObjectId(groupId) } },
            {
                $lookup: {
                    from: 'customsounds',
                    let: { uid: '$userid' },
                    pipeline: [
                        { 
                            $match: { 
                                $expr: { 
                                    $and: [
                                        { $eq: ['$userId', '$$uid'] },
                                        { $eq: ['$groupId', new mongoose.Types.ObjectId(groupId)] }
                                    ]
                                }
                            }
                        },
                        { $count: 'count' }
                    ],
                    as: 'soundsData'
                }
            },
            {
                $lookup: {
                    from: 'users',
                    localField: 'userid',
                    foreignField: '_id',
                    as: 'userInfo'
                }
            },
            { $unwind: '$userInfo' },
            {
                $project: {
                    _id: 0,
                    name: '$userInfo.username',
                    sounds: { 
                        $ifNull: [{ $arrayElemAt: ['$soundsData.count', 0] }, 0]
                    }
                }
            },
            // Sort by sounds descending
            { $sort: { sounds: -1 } }
        ]);

        res.json({ contributions });
    } catch (error) {
        console.error('Error fetching contributions:', error);
        res.status(500).json({ message: 'Failed to fetch contributions' });
    }
});




export default router;
