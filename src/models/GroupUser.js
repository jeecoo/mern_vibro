// models/GroupUser.js
import mongoose from "mongoose";

const groupUserSchema = new mongoose.Schema({
    userid: {
        type: mongoose.Schema.Types.ObjectId,
        ref: "User",
        required: true
    },
    isAdmin: {
        type: Boolean,
        required: true
    },
    groupid: {
        type: mongoose.Schema.Types.ObjectId,
        ref: "Group",
        required: true
    },
    isMonitoringOn:{
        type: Boolean,
        required: true,
        default: false
    }
}, { timestamps: true });

const GroupUser = mongoose.model("GroupUser", groupUserSchema);

export default GroupUser;
