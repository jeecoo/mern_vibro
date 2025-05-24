import mongoose from "mongoose";

const modelModel = new mongoose.Schema(
  {
    groupId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Group", // Corrected: Should be "Group"
      required: true,
    },
    modelName: {
      type: String,
      trim: true,
    },
    modelLabels: {
      type: [String], // ✅ <-- this is the missing part
      default: [],
    },
    labelCount: { // Corrected: Changed "label count" to "labelCount"
      type: Number, // Corrected:  The count should be a Number, not Boolean
      default: 0,  //  It makes more sense to default to 0
    },
  },
  { timestamps: true }
);

const Model = mongoose.model("Model", modelModel);

export default Model;
