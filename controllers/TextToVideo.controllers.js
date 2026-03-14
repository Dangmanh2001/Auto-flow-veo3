const axios = require("axios");
const { GoogleGenAI } = require("@google/genai");
// const puppeteer = require("puppeteer");
const puppeteer = require("puppeteer-extra");
const StealthPlugin = require("puppeteer-extra-plugin-stealth");

const path = require("path");
const models = require("../models/index");
const Command = models.Command;
const Upload = models.Upload;

const command = require("../models/command");

module.exports = {
  TextToVideoveo3Api: async (req, res) => {
    res.render("TextToVideo.ejs");
  },
  TextToVideoveo3ApiPost: async (req, res) => {
    try {
      const path = require("path");
      puppeteer.use(StealthPlugin());
      // if (!req.files || req.files.length === 0) {
      //   return res.status(400).json({
      //     success: false,
      //     message: "Không có file nào được upload",
      //   });
      // }

      // đường dẫn thư mục uploads

      const rawPrompts = req.body.prompts;
      const promptList = rawPrompts
        ? rawPrompts
            .split("\n")
            .map((p) => p.trim())
            .filter((p) => p !== "")
        : [];

      // console.log(uploads);

      // Puppeteer
      async function runFlow() {
        const browser = await puppeteer.launch({
          headless: false,
          userDataDir: "./flow-profile",
          defaultViewport: null,
          args: [
            // Tắt cờ báo hiệu đang bị điều khiển bởi automation
            "--disable-blink-features=AutomationControlled",
          ],
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
          //..................................................
          // Cú pháp XPath: Tìm button chứa thẻ span có chữ "Tạo",
          // sau đó chọn button là anh em đứng ngay trước nó (preceding-sibling)
          // Tìm button là anh em đứng ngay trước cái button chứa thẻ span có chữ "Tạo"
          const xpath =
            "//button[.//span[text()='Tạo']]/preceding-sibling::button";

          // Đợi phần tử xuất hiện trên DOM
          // Thay vì dùng waitForXPath, hãy dùng cách này:
          async function clickAndVerify(page, xpath, description) {
            const locator = page.locator(xpath);
            await locator.click();
            await new Promise((r) => setTimeout(r, 500)); // Đợi UI cập nhật

            // Kiểm tra xem nút đó có trạng thái active/selected không
            const isSelected = await page.evaluate((sel) => {
              // Lưu ý: locator xpath trong evaluate cần dùng document.evaluate
              const el = document.evaluate(
                sel.replace("xpath/", ""),
                document,
                null,
                XPathResult.FIRST_ORDERED_NODE_TYPE,
                null,
              ).singleNodeValue;
              if (!el) return false;
              return (
                el.getAttribute("data-state") === "active" ||
                el.getAttribute("aria-selected") === "true" ||
                el.classList.contains("active")
              ); // Tùy vào CSS của trang
            }, xpath);

            console.log(
              `[${description}] - ${isSelected ? "✅ Thành công" : "❌ Thất bại hoặc không kiểm tra được trạng thái"}`,
            );
          }

          // --- THỰC THI ---

          // 0. Mở menu chính
          try {
            // Mở menu chính - Nếu lỗi ở đây thì các bước con cũng sẽ tự skip trong catch của clickAndVerify
            const mainMenuXpath =
              'xpath///button[.//span[text()="Tạo"]]/preceding-sibling::button';
            await page
              .locator(mainMenuXpath)
              .click()
              .catch(() => console.log("Menu chính có vẻ đã mở"));
            await new Promise((r) => setTimeout(r, 600));

            // Thực hiện chuỗi click lần lượt
            // Sử dụng class đặc trưng của tab slider
            await page.click(
              'button.flow_tab_slider_trigger[aria-controls*="VIDEO"]',
            );
            await clickAndVerify(
              page,
              "xpath///button[contains(., 'Khung hình')]",
              "Chọn Frames",
            );
            await clickAndVerify(
              page,
              "xpath///button[contains(., 'Ngang')]",
              "Chọn Khung hình",
            );
            // Click vào button có class cụ thể và chứa text x1
            await page.click("button.flow_tab_slider_trigger::-p-text(x1)");
          } catch (globalError) {
            console.log(
              "Có lỗi trong cụm thiết lập, nhưng script vẫn sẽ chạy tiếp các bước sau...",
            );
          }

          // --- TIẾP TỤC CÁC CÔNG VIỆC KHÁC TẠI ĐÂY ---
          console.log(
            "Đang chuyển sang bước tiếp theo (nhập prompt hoặc render)...",
          );

          for (let i = 0; i < promptList.length; i++) {
            await page.waitForSelector('[role="textbox"]', {
              visible: true,
              timeout: 60000,
            });
            const editor = await page.$('[role="textbox"]');
            // 6️⃣ Type thật thay vì innerHTML
            const currentPrompt = promptList[i];
            await editor.type(currentPrompt);
            //.........................................................................................................
            // Tìm nút dựa trên nội dung text "Tạo"
            await page.click("button ::-p-text(Tạo)");
            console.log("✅ Đã click nút Tạo");
            //.........................................................................................................
            // 1. Lấy số lượng video hiện tại TRƯỚC KHI chờ render để làm mốc so sánh
            let videoCount = await page.evaluate(
              () =>
                document.querySelectorAll('video[src*="getMediaUrlRedirect"]')
                  .length,
            );
            let isFinished = false;
            console.log("⏳ Đang đợi video render hoặc báo lỗi...");
            while (!isFinished) {
              try {
                // Sử dụng Promise.race để xem việc gì đến trước: Thành công hay Thất bại
                const result = await Promise.race([
                  // Nhánh 1: Đợi video mới xuất hiện (Thành công)
                  page
                    .waitForFunction(
                      (count) => {
                        const vids = document.querySelectorAll(
                          'video[src*="getMediaUrlRedirect"]',
                        );
                        return vids.length > count;
                      },
                      { timeout: 15000 }, // Kiểm tra mỗi 15 giây
                      videoCount,
                    )
                    .then(() => "SUCCESS"),
                  // Nhánh 2: Đợi nút "Thử lại" xuất hiện (Thất bại)
                  page
                    .waitForSelector(
                      'xpath///button[.//span[contains(text(), "Thử lại")] or .//i[text()="refresh"]]',
                      { timeout: 15000, visible: true },
                    )
                    .then(() => "RETRY_NEEDED"),
                ]);
                if (result === "SUCCESS") {
                  console.log("✅ Video đã render xong!");
                  isFinished = true; // Thoát vòng lặp để chạy code phía sau
                } else if (result === "RETRY_NEEDED") {
                  console.log("⚠️ Phát hiện nút Thử lại, đang bấm...");
                  await page.evaluate(() => {
                    const buttons = Array.from(
                      document.querySelectorAll("button"),
                    );
                    const retryBtn = buttons.find((btn) =>
                      btn.innerText.includes("Thử lại"),
                    );
                    if (retryBtn) retryBtn.click();
                  });
                  // Đợi một chút để trang web reset trạng thái render trước khi check lại
                  await new Promise((r) => setTimeout(r, 5000));
                }
              } catch (e) {
                // Nếu cả 2 đều không thấy (vẫn đang render bình thường), lặp lại
                console.log("...vẫn đang render...");
              }
            }
            // --- KẾT THÚC ĐOẠN THAY THẾ ---
            // Code phía sau của bạn tiếp tục ở đây (ví dụ: tải video về, chuyển sang prompt tiếp theo...)
            console.log("🚀 Chuẩn bị xử lý bước tiếp theo...");
          }
        } catch (error) {
          console.error("Lỗi:", error.message);
          // chụp screenshot khi lỗi
          await page.screenshot({
            path: "error.png",
            fullPage: true,
          });
        }
      }
      runFlow();

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
  ImagetoVideo: async (req, res) => {},
  ImagetoVideoPost: async (req, res) => {},
  gemini: async (req, res) => {
    res.render("gemini.ejs");
  },

  postGemini: async (req, res) => {
    const ai = new GoogleGenAI({
      apiKey: "AIzaSyB_om2qfxWst4S4rFGRUY1lAtsZdXffbLo",
    });
    async function run() {
      const response = await ai.models.generateContent({
        model: "gemini-2.5-flash",
        contents: [
          {
            role: "user",
            parts: [
              {
                fileData: {
                  fileUri: "https://www.youtube.com/watch?v=kaRrw-FI_Og&t=12s",
                  mimeType: "video/*",
                },
              },
              {
                text: `Bạn là chuyên gia phân tích video.
    Bạn là chuyên gia phân tích video.

    Hãy chia nội dung sau thành nhiều scene điện ảnh.

    Chia làm sao cho thời lượng các cảnh cộng lại bằng đúng thời lượng của video.

    Mỗi scene 4 đến 8 giây.

    Phân tích đủ thời lượng video,

    Trả về JSONL (mỗi dòng 1 object).

    Liệt kê đầy đủ hoặc tạo file json đẩy đủ để tải về.

    Schema:

    {

     "scene_id": "",

     "duration_sec": "",

     "visual_style": "",

     "camera": {

       "shot_type": "",

       "angle": "",

       "movement": ""

     },

     "audio": {

       "dialogue": []

     },

     "prompt": ""

    }

    Schema:

    {
     "scene_id": "",
     "duration_sec": "",
     "visual_style": "",
     "camera": {
       "shot_type": "",
       "angle": "",
       "movement": ""
     },
     "audio": {
       "dialogue": []
     },
     "prompt": ""
    }
    `,
              },
            ],
          },
        ],
      });

      console.log(response.text);
    }

    run();
    res.send("Done");
  },
};
