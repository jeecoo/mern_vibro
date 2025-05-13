// models/Group.js
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
        default: "", 
    },
    isActive: {
        type: Boolean,
        default: true, 
    },
    createdBy: {
        type: mongoose.Schema.Types.ObjectId,
        ref: "User",
        required: true,
    }
}, { timestamps: true });

groupSchema.pre('save', function(next) {
 
    next();
});

const Group = mongoose.model("Group", groupSchema);

export default Group;
