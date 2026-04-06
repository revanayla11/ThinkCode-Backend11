const express = require("express");
const router = express.Router();
const materiController = require("../controllers/materiController"); // Pastikan path benar
const verifyToken = require("../middleware/verifyToken");

// 🆕 DEBUG - Cek apakah controller loaded
console.log("Controller loaded:", Object.keys(materiController));

// Routes
router.get("/", materiController.listMateri);           // Pastikan ada di controller
router.get("/:id", materiController.getMateriDetail);   // Pastikan ada di controller
router.post("/:id/progress", verifyToken, materiController.updateProgress);
router.post("/:id/complete-step", verifyToken, materiController.completeStep);

// 🆕 Optional verifyToken
function verifyTokenOptional(req, res, next) {
  const auth = req.headers.authorization;
  if (auth && auth.startsWith('Bearer ')) {
    try {
      const jwt = require("jsonwebtoken");
      const decoded = jwt.verify(auth.split(" ")[1], process.env.JWT_SECRET || "secretjwt");
      req.user = decoded;
    } catch (e) {
      console.log("Token invalid, continue as guest");
    }
  }
  next();
}

module.exports = router;