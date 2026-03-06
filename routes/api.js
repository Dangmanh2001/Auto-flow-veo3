var express = require("express");
var router = express.Router();
const apiControllers = require("../controllers/api.controllers");
const multer = require("multer");
const path = require("path");
const fs = require("fs");

// Cấu hình storage
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, "uploads/");
  },
  filename: (req, file, cb) => {
    // const filePath = path.join("uploads", file.originalname);

    // if (fs.existsSync(filePath)) {
    //   return cb(new Error("File đã tồn tại"));
    // }

    // Tên file: timestamp + tên gốc
    cb(null, file.originalname);
  },
});

const upload = multer({
  storage: storage,
  limits: { fileSize: 50 * 1024 * 1024 }, // 50MB
  fileFilter: (req, file, cb) => {
    // Chỉ cho upload file ảnh
    const allowedMimes = ["image/jpeg", "image/png", "image/gif", "image/webp"];

    if (!allowedMimes.includes(file.mimetype)) {
      return cb(new Error(`File type ${file.mimetype} không được phép`));
    }

    const filePath = path.join(__dirname, "..", "uploads", file.originalname);

    // nếu file đã tồn tại thì bỏ qua
    if (fs.existsSync(filePath)) {
      console.log("File đã tồn tại:", file.originalname);
      return cb(null, true);
    }

    cb(null, true);
  },
});

/* GET home page. */
router.get("/", apiControllers.veo3Api);
// Thêm middleware upload.array() để xử lý nhiều file với field name là "images"
router.post("/", upload.array("images"), apiControllers.veo3ApiPost);

module.exports = router;
