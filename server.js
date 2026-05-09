const express = require("express");
const { chromium } = require("playwright");

const app = express();
app.use(express.json({ limit: "20mb" }));

const jobs = {};

async function createWithChatGPT(jobId, data) {
  const browser = await chromium.connectOverCDP("http://127.0.0.1:9222");
  const context = browser.contexts()[0];
  const page = await context.newPage();

  jobs[jobId].status = "running";

  await page.goto("https://chatgpt.com", {
    waitUntil: "domcontentloaded",
    timeout: 60000
  });

  await page.waitForTimeout(3000);

  const prompt = `
${data.prompt}

Referans görsel:
${data.sourceImageUrl}

PUSULA SPOR logosu:
${data.logoUrl || "Logo daha sonra footer olarak eklenecek."}

Haber başlığı:
${data.title}
`;

  const textarea = page.locator("textarea").first();

  await textarea.waitFor({ timeout: 60000 });
  await textarea.fill(prompt);
  await page.keyboard.press("Enter");

  jobs[jobId].status = "waiting_image";

  // Görsel üretimi için bekle
  await page.waitForTimeout(120000);

  // Sayfadaki son görseli bul
  const images = await page.locator("img").evaluateAll(imgs =>
    imgs.map(img => img.src).filter(src =>
      src &&
      src.startsWith("http") &&
      !src.includes("avatar") &&
      !src.includes("favicon")
    )
  );

  if (!images.length) {
    throw new Error("No generated image found");
  }

  const finalImage = images[images.length - 1];

  jobs[jobId].status = "done";
  jobs[jobId].imageUrl = finalImage;

  await page.close();
}

app.get("/", (req, res) => {
  res.send("OK");
});

app.post("/create-image", async (req, res) => {
  const jobId = Date.now().toString();

  jobs[jobId] = {
    status: "queued",
    imageUrl: null,
    error: null
  };

  res.json({
    status: "processing",
    jobId
  });

  createWithChatGPT(jobId, req.body).catch(err => {
    jobs[jobId].status = "error";
    jobs[jobId].error = err.message;
  });
});

app.get("/result/:jobId", (req, res) => {
  const job = jobs[req.params.jobId];

  if (!job) {
    return res.json({ status: "not_found" });
  }

  res.json(job);
});

app.listen(3000, "0.0.0.0", () => {
  console.log("Local worker running on 3000");
});
