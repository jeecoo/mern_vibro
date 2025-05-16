// models/CustomFolder.js
import mongoose from "mongoose";

const customFolderSchema = new mongoose.Schema({
  folderName: {
    type: String,
    required: [true, "Folder name is required"],
    trim: true,
    minlength: [1, "Folder name must be at least 1 character long"],
    maxlength: [100, "Folder name cannot exceed 100 characters"],
  },
  groupId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "Group",
    required: true,
    index: true, // Good for querying folders within a group
  },
  createdBy: { // Optional: If you want to track who created the folder
    type: mongoose.Schema.Types.ObjectId,
    ref: "User",
  },
}, { timestamps: true });

const CustomFolder = mongoose.model("CustomFolder", customFolderSchema);

export default CustomFolder;