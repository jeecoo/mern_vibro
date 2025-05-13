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
    message: { 
        type: String,
        required: true,
    },
    imageUrl: {
        type: String,
        default: "",
    },
}, { timestamps: true }); 

const Message = mongoose.model("Message", messageSchema);
export default Message;