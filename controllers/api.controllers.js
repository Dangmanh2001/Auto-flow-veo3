const fs = require("fs");
const axios = require("axios");
const { GoogleGenAI } = require("@google/genai");
const os = require("os");
const puppeteer = require("puppeteer");
const path = require("path");
const models = require("../models/index");
const Command = models.Command;
const Upload = models.Upload;

const XLSX = require("xlsx");
const command = require("../models/command");

module.exports = {
  veo3Api: async (req, res) => {
    res.render("api.ejs");
  },
  veo3ApiPost: async (req, res) => {
    try {
      const path = require("path");

      if (!req.files || req.files.length === 0) {
        return res.status(400).json({
          success: false,
          message: "Không có file nào được upload",
        });
      }

      // đường dẫn thư mục uploads
      const uploadDir = path.join(__dirname, "..", "uploads");
      const uploadedFiles = req.files.map((file) => ({
        originalName: file.originalname,
        filename: file.filename,
        size: file.size,
        mimetype: file.mimetype,
        uploadDate: new Date(),
        path_img: path.resolve(file.path).replace(/\\/g, "\\"),
      }));
      const imagePaths = [];
      for (const file of uploadedFiles) {
        const path_img = file.path_img.replace(/\\/g, "\\\\");
        const name_img = file.filename;
        // console.log(name_img);
        await Upload.create({ path_img, name_img });
        imagePaths.push(path_img);
        // console.log(path_img);
      }
      const uploads = await Upload.findAll();
      // console.log(uploads);
      const prompts = [
        "A cat sitting on a laptop",
        "A futuristic city at night",
        "A robot cooking in a kitchen",
        "A dragon flying over mountains",
        "A cyberpunk street market",
      ];
      function randomItem(arr) {
        return arr[Math.floor(Math.random() * arr.length)];
      }
      const randomPrompt = randomItem(prompts);

      const startImage = randomItem(uploads);
      const endImage = randomItem(uploads);
      // console.log(startImage);
      // console.log(endImage);
      const command = await Command.create({
        prompt: randomPrompt,
        start_pic: startImage.id,
        end_pic: endImage.id,
      });
      const id = command.dataValues.id;
      console.log(id);
      const filenameStart = await Upload.findByPk(command.dataValues.start_pic);
      const filenameEnd = await Upload.findByPk(command.dataValues.end_pic);
      console.log(
        filenameStart.dataValues.name_img,
        filenameEnd.dataValues.name_img,
      );

      // Puppeteer
      async function runFlow(prompt) {
        const browser = await puppeteer.launch({
          headless: false,
          userDataDir: "./flow-profile",
          defaultViewport: null,
          args: ["--start-maximized"],
        });
        const page = await browser.newPage();
        try {
          // 1️⃣ Chỉ goto 1 lần
          await page.goto("https://labs.google/fx/vi/tools/flow", {
            waitUntil: "networkidle2",
            timeout: 60000,
          });
          const finalUrl = page.url();
          console.log("URL cuối:", finalUrl);
          if (finalUrl.includes("accounts.google.com")) {
            console.log("Chưa login Google");
            return;
          }
          // 2️⃣ Đợi nút Dự án mới xuất hiện thật sự
          await page.waitForFunction(
            () => {
              return [...document.querySelectorAll("button")].some((btn) =>
                btn.textContent?.includes("Dự án mới"),
              );
            },
            { timeout: 60000 },
          );
          // 3️⃣ Click bằng .click() chuẩn
          await page.evaluate(() => {
            const btn = [...document.querySelectorAll("button")].find((btn) =>
              btn.textContent?.includes("Dự án mới"),
            );
            if (!btn) throw new Error("Không tìm thấy nút Dự án mới");
            btn.scrollIntoView({ block: "center" });
            btn.click();
          });
          console.log("Đã click Dự án mới");
          // 4️⃣ Đợi editor sẵn sàng
          await page.waitForSelector('[role="textbox"]', {
            visible: true,
            timeout: 60000,
          });
          const editor = await page.$('[role="textbox"]');
          // 5️⃣ Clear nội dung an toàn
          await editor.click({ clickCount: 3 });
          await page.keyboard.press("Backspace");
          // 6️⃣ Type thật thay vì innerHTML
          await editor.type(prompt, { delay: 50 });
          console.log("Đã nhập prompt");
          await page.waitForFunction(() =>
            [...document.querySelectorAll("button")].some((btn) =>
              btn.textContent?.includes("Thêm nội dung nghe nhìn"),
            ),
          );
          const buttons = await page.$$("button");
          for (const btn of buttons) {
            const text = await btn.evaluate((el) => el.textContent);
            if (text?.includes("Thêm nội dung nghe nhìn")) {
              await btn.hover();
              await btn.click();
              break;
            }
          }
          // Đợi menu item xuất hiện
          await page.waitForFunction(
            () =>
              [...document.querySelectorAll('[role="menuitem"]')].some((el) =>
                el.textContent?.includes("Tải hình ảnh lên"),
              ),
            { timeout: 10000 },
          );
          console.log("Đã click Add");
          console.log("Menu đã render");
          // Lấy tất cả menuitem
          const menuItems = await page.$$('[role="menuitem"]');
          // 1️⃣ Click "Tải hình ảnh lên"
          for (const item of menuItems) {
            const text = await item.evaluate((el) => el.textContent);
            if (text?.includes("Tải hình ảnh lên")) {
              await item.hover();
              // Bắt file dialog
              const fileChooserPromise = page.waitForFileChooser();
              await item.click();
              try {
                const fileChooser = await fileChooserPromise;

                await fileChooser.accept(imagePaths);
                console.log("✅ Đã upload hình ảnh");
                await page.waitForFunction(
                  () => {
                    const img = document.querySelector(
                      'img[src*="getMediaUrlRedirect"]',
                    );
                    return img && img.complete && img.naturalHeight > 0;
                  },
                  { timeout: 120000 },
                );
                console.log("✅ Ảnh đã tải xong 100%");
                // Đợi Veo3 xử lý ảnh
                await new Promise((r) => setTimeout(r, 3000)); //Cần thay đổi ngẫu nhiên thời gian
              } catch (error) {
                console.error("❌ Lỗi upload:", error.message);
              }
              break;
            }
          }
          //.........................................................................................................
          // Generate video
          // 1️⃣ Chọn ảnh bắt đầu và kết thúc
          async function selectImageForButton(page, buttonText, fileName) {
            // 1️⃣ Đợi nút xuất hiện
            await page.waitForFunction(
              (text) =>
                [...document.querySelectorAll("div")].some(
                  (el) => el.textContent?.trim() === text,
                ),
              {},
              buttonText,
            );
            // 2️⃣ Click nút (Bắt đầu hoặc Kết thúc)
            await page.evaluate((text) => {
              const btn = [...document.querySelectorAll("div")].find(
                (el) => el.textContent?.trim() === text,
              );
              if (btn) btn.click();
            }, buttonText);
            console.log(`Đã click ${buttonText}`);
            // 3️⃣ Đợi media picker load ảnh
            await page.waitForSelector(`img[alt="${fileName}"]`, {
              timeout: 10000,
            });
            console.log("Media picker đã load");
            // 4️⃣ Click ảnh
            await page.click(`img[alt="${fileName}"]`);
            console.log(`Đã chọn ảnh ${fileName}`);
          }
          await selectImageForButton(
            page,
            "Bắt đầu",
            filenameStart.dataValues.name_img,
          );
          await selectImageForButton(
            page,
            "Kết thúc",
            filenameEnd.dataValues.name_img,
          );
          //.........................................................................................................
          await page.click(
            "button.sc-e8425ea6-0.gLXNUV.sc-d3791a4f-0.sc-d3791a4f-4.sc-21faa80e-4",
          );
          console.log("✅ Đã click nút Tạo");
          //.........................................................................................................
          console.log("Flow đã generate");
        } catch (error) {
          console.error("Lỗi:", error.message);
          // chụp screenshot khi lỗi
          await page.screenshot({
            path: "error.png",
            fullPage: true,
          });
        }
      }
      runFlow(command.dataValues.prompt);

      res.redirect("/api");
    } catch (error) {
      console.error("❌ LỖI UPLOAD:", error.message);
      res.status(500).json({
        success: false,
        message: "Lỗi khi upload file",
        error: error.message,
      });
    }
  },

  postAuto: async (req, res) => {},
};
