var express = require("express");
var router = express.Router();
const multer = require("multer");
const path = require("path");
const fs = require("fs");
const TextToVideoControllers = require("../controllers/TextToVideo.controllers");
const ImageToVideoController = require("../controllers/ImageToVideo.controller");
const IngredientsToVideo = require("../controllers/IngredientsToVideo");

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

/* Tạo video bằng text */
router.get("/", TextToVideoControllers.TextToVideoveo3Api);
// Thêm middleware upload.array() để xử lý nhiều file với field name là "images"
router.post(
  "/",
  upload.array("images"),
  TextToVideoControllers.TextToVideoveo3ApiPost,
);
/* Tạo video bằng Ảnh */
router.get("/imageToVideo", ImageToVideoController.ImageToVideo);

router.post(
  "/imageToVideo",
  upload.fields([
    { name: "start_images[]", maxCount: 10 },
    { name: "end_images[]", maxCount: 10 },
  ]),
  ImageToVideoController.ImageToVideoPost,
);
/* Tạo video thành phần */
router.get("/IngredientsToVideo", IngredientsToVideo.IngredientsToVideo);
router.post("/IngredientsToVideo", IngredientsToVideo.IngredientsToVideoPost);
/* Gọi api gemini để phân tích video */
router.get("/gemini", TextToVideoControllers.gemini);
router.post("/gemini", TextToVideoControllers.postGemini);

module.exports = router;
