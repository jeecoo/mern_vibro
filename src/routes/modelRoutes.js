import express from 'express';

import Model from '../models/Model.js';
 
const router = express.Router();

// Create a new model document
router.post("/", async (req, res) => {
  try {
    const { modelName, modelPath } = req.body;
    const model = new Model({ modelName, modelPath });
    await model.save();
    res.status(201).json(model);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

// Get all models
router.get("/", async (req, res) => {
  try {
    const models = await Model.find();
    res.json(models);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

// Get one model by ID
router.get("/:id", async (req, res) => {
  try {
    const model = await Model.findById(req.params.id);
    if (!model) return res.status(404).json({ message: "Model not found" });
    res.json(model);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});
router.get("/bygroup/:id", async (req, res) => {
  try {
    console.log("Fetching model by group ID:", req.params.id);
    
    const model = await Model.findOne({ groupId: req.params.id });
    if (!model) return res.status(404).json({ message: "Model not found" });
    res.json(model);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

// Update a model by ID
router.put("/:id", async (req, res) => {
  try {
    const { modelName, modelPath } = req.body;
    const model = await Model.findByIdAndUpdate(
      req.params.id,
      { modelName, modelPath },
      { new: true, runValidators: true }
    );
    if (!model) return res.status(404).json({ message: "Model not found" });
    res.json(model);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

// Delete a model by ID
router.delete("/:id", async (req, res) => {
  try {
    const model = await Model.findByIdAndDelete(req.params.id);
    if (!model) return res.status(404).json({ message: "Model not found" });
    res.json({ message: "Model deleted successfully" });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

export default router;
