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
        const userId = req.user.userId;

        const group = await Group.findById(groupId);

        if (!group) {
            return res.status(404).json({ message: 'Group not found' });
        }

        // Authorization: Check if the logged-in user is an admin of this group
        if (!group.admins.includes(userId)) {
            return res.status(403).json({ message: 'User not authorized to update this group.' });
        }

        if (groupName !== undefined) {
            if (groupName.trim().length < 3) {
                 return res.status(400).json({ message: 'Group name must be at least 3 characters long.' });
            }
            group.groupName = groupName.trim();
        }
        if (groupPhoto !== undefined) {
            group.groupPhoto = groupPhoto; // Allow empty string to remove photo
        }
        if (isActive !== undefined && typeof isActive === 'boolean') {
            group.isActive = isActive;
        }

        const updatedGroup = await group.save();
        const populatedGroup = await Group.findById(updatedGroup._id)
            .populate('members', 'username profileImage email')
            .populate('admins', 'username profileImage email')
            .populate('createdBy', 'username profileImage email');

        res.status(200).json({ group: populatedGroup, message: 'Group updated successfully' });
    } catch (error) {
        console.error("Error updating group:", error);
        if (error.name === 'ValidationError') {
            return res.status(400).json({ message: error.message });
        }
        res.status(500).json({ message: 'Server error while updating group', error: error.message });
    }
});

// 5. Delete a group
// DELETE /api/groups/:groupId
// Requires authentication and user to be an admin of the group (or creator)
router.delete('/:groupId', verifyToken, async (req, res) => {
    try {
        const groupId = req.params.groupId;
        const userId = req.user.userId;

        const group = await Group.findById(groupId);

        if (!group) {
            return res.status(404).json({ message: 'Group not found' });
        }

        // Authorization: Check if the logged-in user is an admin or the creator
        // For simplicity, only admins can delete. You can add || group.createdBy.equals(userId)
        if (!group.admins.includes(userId)) {
            return res.status(403).json({ message: 'User not authorized to delete this group. Only admins can delete.' });
        }

        await Group.findByIdAndDelete(groupId);

        res.status(200).json({ message: 'Group deleted successfully' });
    } catch (error) {
        console.error("Error deleting group:", error);
        res.status(500).json({ message: 'Server error while deleting group', error: error.message });
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
// Requires authentication. Logged-in user must be an admin OR the member being removed.
router.delete('/:groupId/members/:memberId', verifyToken, async (req, res) => {
    try {
        const { groupId, memberId } = req.params;
        const loggedInUserId = req.user.userId;

        const group = await Group.findById(groupId);
        if (!group) {
            return res.status(404).json({ message: 'Group not found.' });
        }

        // Check if the member to remove is actually in the group
        const memberIndex = group.members.indexOf(memberId);
        if (memberIndex === -1) {
            return res.status(404).json({ message: 'Member not found in this group.' });
        }

        // Authorization:
        // 1. Logged-in user is an admin of the group OR
        // 2. Logged-in user is the member being removed (leaving the group)
        const isAdmin = group.admins.includes(loggedInUserId);
        const isRemovingSelf = loggedInUserId === memberId;

        if (!isAdmin && !isRemovingSelf) {
            return res.status(403).json({ message: 'User not authorized to remove this member.' });
        }
        
        // Prevent removing the creator if they are the last admin and member
        // This is a simplified check; more complex logic might be needed for "last admin" scenarios
        if (group.createdBy.equals(memberId) && group.admins.includes(memberId) && group.admins.length === 1 && group.members.length === 1) {
            return res.status(400).json({ message: 'Cannot remove the group creator if they are the last admin and member. Delete the group instead or assign a new admin.' });
        }


        group.members.pull(memberId); // Remove from members array
        group.admins.pull(memberId);  // Also remove from admins array if they were an admin

        // Optional: If the group becomes empty, you might want to make it inactive or delete it.
        if (group.members.length === 0) {
            group.isActive = false;
            // Or: await Group.findByIdAndDelete(groupId);
            // console.log(Group ${groupId} is now empty and deactivated.);
        }
        
        // If the last admin is removed (and it's not the creator who is also the last member)
        // you might need logic to assign a new admin or handle the group.
        // For simplicity, this is not deeply handled here.

        await group.save();
        const populatedGroup = await Group.findById(groupId)
            .populate('members', 'username profileImage email')
            .populate('admins', 'username profileImage email')
            .populate('createdBy', 'username profileImage email');

        res.status(200).json({ group: populatedGroup, message: 'Member removed successfully.' });

    } catch (error) {
        console.error("Error removing member from group:", error);
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
        group.members.push(userId);
        await group.save();

        // Return the updated group with the new member
        const populatedGroup = await Group.findById(groupId)
            .populate('members', 'username profileImage email')
            .populate('admins', 'username profileImage email')
            .populate('createdBy', 'username profileImage email');

        res.status(200).json({ group: populatedGroup, message: 'Joined group successfully.' });
    } catch (error) {
        console.error("Error joining group:", error);
        res.status(500).json({ message: 'Server error while joining group', error: error.message });
    }
});




export default router;
