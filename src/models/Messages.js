// models/Messages.js
import mongoose from "mongoose";

const messageSchema = new mongoose.Schema({
    senderId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: "User", 
        required: true,
    },
    groupId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: "Group",
        required: true,
    },
    messageType: {
        type: String,
        enum: ["text", "image"],
        required: true,
    },
    messageText: { 
        type: String,
        trim: true,
        default: null, 
    },
    imageUrl: {
        type: String,
        default: null, 
    },
    readBy: [{
        type: mongoose.Schema.Types.ObjectId,
        ref: "User"
    }],
    // 'chat' field removed as groupId serves the purpose for group chats
    // 'content' field removed as messageText and imageUrl cover it
}, { timestamps: true }); 


messageSchema.index({ groupId: 1, createdAt: 1 });

const Message = mongoose.model("Message", messageSchema);
export default Message;