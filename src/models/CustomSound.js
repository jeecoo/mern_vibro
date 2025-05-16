// models/CustomSound.js
import mongoose from "mongoose";

const customSoundSchema = new mongoose.Schema({
  groupId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "Group",
    required: true,
    index: true, // Good for querying sounds within a group
  },
  userId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "User",
    required: true, // Indicate who added the sound
    index: true, // Good for querying sounds added by a specific user
  },
  folderId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "CustomFolder",
    required: true, // Indicate who added the sound
    index: true, // Good for querying sounds added by a specific user
  },
  sound: {
    type: String, // Store the WAV file as a Buffer (binary data)
    required: [true, "Sound file is required"],
  },
  filename: { // Optional: Store the original filename
    type: String,
    trim: true,
  },
  mimeType: { // Optional: Store the MIME type (e.g., 'audio/wav')
    type: String,
    default: 'audio/wav',
  },
  folderId: { // Optional: To associate the sound with a custom folder
    type: mongoose.Schema.Types.ObjectId,
    ref: "CustomFolder",
    index: true, // Good for querying sounds within a specific folder
  },
}, { timestamps: true });

const CustomSound = mongoose.model("CustomSound", customSoundSchema);

export default CustomSound;