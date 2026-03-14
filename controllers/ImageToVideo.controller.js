const axios = require("axios");
const { GoogleGenAI } = require("@google/genai");
const puppeteer = require("puppeteer");
const path = require("path");
const models = require("../models/index");
const Command = models.Command;
const Upload = models.Upload;

const command = require("../models/command");

module.exports = {
  ImageToVideo: async (req, res) => {
    res.render("ImageToVideo.ejs");
  },
  ImageToVideoPost: async (req, res) => {
    // 1. Lấy dữ liệu TEXT (Các ô textarea)
    // Multer sẽ đổ các field không phải file vào req.body
    const prompts = req.body.prompts || [];

    // 2. Lấy dữ liệu FILES (Các ô input file)
    const startImages = req.files["start_images[]"] || [];
    const endImages = req.files["end_images[]"] || [];
    // Đảm bảo prompts luôn là mảng để dùng .map
    const promptList = Array.isArray(prompts) ? prompts : [prompts];

    // Gộp dữ liệu dựa trên Index
    const tasks = promptList.map((prompt, index) => {
      return {
        id: index + 1,
        prompt: prompt,
        // Lấy file tương ứng tại vị trí index
        startImage: startImages[index] ? startImages[index].path : null,
        endImage: endImages[index] ? endImages[index].path : null,
      };
    });

    console.log("--- Danh sách Task đã phân loại ---");
    console.table(tasks); // In bảng để dễ quan sát

    // Giờ bạn có thể duyệt qua từng task để chạy automation
    // tasks.forEach(task => runAutomation(task));

    // Xử lý logic render video của bạn ở đây...
    res.redirect("/api/imageToVideo");
  },
};
