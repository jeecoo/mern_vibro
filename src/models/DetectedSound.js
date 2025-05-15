// models/Group.js
import mongoose from "mongoose";

const detectedSound = new mongoose.Schema({
    userid: {
            type: mongoose.Schema.Types.ObjectId,
            ref: "User",
            required: true
        },
    label: {
        type: String,
        required: true,
    },
    confidence: {
        type: String,
        required: true,
    },
     sound: {
        type: String,
        required: true,
    }
   
}, { timestamps: true });

detectedSound.pre('save', function(next) {
 
    next();
});

const DetectedSound = mongoose.model("DetectedSound", detectedSound);

export default DetectedSound;
