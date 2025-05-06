
import mongoose from "mongoose";

const groupSchema = new mongoose.Schema({
    groupName: {
        type: String,
        required: [true, "Group name is required"],
        trim: true,
        minlength: [3, "Group name must be at least 3 characters long"],
        maxlength: [100, "Group name cannot exceed 100 characters"]
    },
    groupPhoto: {
        type: String,
        default: "", // You can set a default group photo URL here if you like
    },
    members: [{
        type: mongoose.Schema.Types.ObjectId,
        ref: "User", // References the 'User' model
    }],
    admins: [{ // Optional: to specify users who can manage the group
        type: mongoose.Schema.Types.ObjectId,
        ref: "User",
    }],
    isActive: {
        type: Boolean,
        default: true, // Groups are active by default
    },
    createdBy: { // To know who created the group
        type: mongoose.Schema.Types.ObjectId,
        ref: "User",
        required: true,
    }
}, { timestamps: true });

// Optional: Pre-save hook to add the creator to members and admins
groupSchema.pre('save', function(next) {
    if (this.isNew) {
        if (!this.members.includes(this.createdBy)) {
            this.members.push(this.createdBy);
        }
        if (!this.admins.includes(this.createdBy)) {
            this.admins.push(this.createdBy);
        }
    }
    next();
});

const Group = mongoose.model("Group", groupSchema);

export default Group