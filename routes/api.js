var express = require("express");
var router = express.Router();
const apiControllers = require("../controllers/api.controllers");
const multer = require("multer");
const path = require("path");

// Cấu hình storage
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, "uploads/");
  },
  filename: (req, file, cb) => {
    // Tên file: timestamp + tên gốc
    cb(null, Date.now() + "-" + file.originalname);
  },
});

const upload = multer({
  storage: storage,
  limits: { fileSize: 50 * 1024 * 1024 }, // 50MB
  fileFilter: (req, file, cb) => {
    // Chỉ cho upload file ảnh
    const allowedMimes = ["image/jpeg", "image/png", "image/gif", "image/webp"];

    if (allowedMimes.includes(file.mimetype)) {
      cb(null, true);
    } else {
      cb(new Error(`File type ${file.mimetype} không được phép`));
    }
  },
});
/* GET home page. */
router.get("/", apiControllers.veo3Api);
router.post("/", upload.array("images", 10), apiControllers.veo3ApiPost);

module.exports = router;
