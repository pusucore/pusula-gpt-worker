const express = require("express");
const { chromium } = require("playwright");
const fs = require("fs");
const path = require("path");

const app = express();
app.use(express.json({ limit: "20mb" }));

const jobs = {};
const OUT_DIR = path.join(__dirname, "outputs");

if (!fs.existsSync(OUT_DIR)) fs.mkdirSync(OUT_DIR, { recursive: true });

async function downloadFile(url, filepath) {
  const res = await fetch(url, { headers: { "User-Agent": "Mozilla/5.0" } });
  if (!res.ok) throw new Error(`Download failed: ${res.status} ${url}`);
  const buffer = Buffer.from(await res.arrayBuffer());
  fs.writeFileSync(filepath, buffer);
}

async function fillPrompt(page, text) {
  const selectors = [
    "#prompt-textarea",
    "div[contenteditable='true']",
    "textarea"
  ];

  for (const selector of selectors) {
    const el = page.locator(selector).first();
    if (await el.count()) {
      await el.click();
      await page.keyboard.insertText(text);
      return;
    }
  }

  throw new Error("Prompt input not found");
}

async function uploadFiles(page, files) {
  const input = page.locator("input[type='file']").first();

  if (await input.count()) {
    await input.setInputFiles(files);
    return;
  }

  const attachButton = page.locator(
    "button[aria-label*='Attach'], button[aria-label*='Dosya'], button[aria-label*='Ekle']"
  ).first();

  if (await attachButton.count()) {
    const chooserPromise = page.waitForEvent("filechooser");
    await attachButton.click();
    const chooser = await chooserPromise;
    await chooser.setFiles(files);
    return;
  }

  throw new Error("File upload input/button not found");
}

async function waitAndScreenshotGeneratedImage(page, outputPath) {
  const started = Date.now();
  const timeout = 1000 * 60 * 5;

  while (Date.now() - started < timeout) {
    const candidates = page.locator("img");

    const count = await candidates.count();

    for (let i = count - 1; i >= 0; i--) {
      const img = candidates.nth(i);
      const box = await img.boundingBox().catch(() => null);

      if (box && box.width >= 450 && box.height >= 450) {
        await img.screenshot({ path: outputPath });
        return;
      }
    }

    await page.waitForTimeout(5000);
  }

  throw new Error("Generated image not found in time");
}

async function createWithChatGPT(jobId, data) {
  const jobDir = path.join(OUT_DIR, jobId);
  fs.mkdirSync(jobDir, { recursive: true });

  const sourcePath = path.join(jobDir, "source.jpg");
  await downloadFile(data.sourceImageUrl, sourcePath);

  const files = [sourcePath];

  if (data.logoUrl && data.logoUrl.startsWith("http")) {
    const logoPath = path.join(jobDir, "logo.png");
    await downloadFile(data.logoUrl, logoPath);
    files.push(logoPath);
  }

  const browser = await chromium.connectOverCDP("http://127.0.0.1:9222");
  const context = browser.contexts()[0];
  const page = await context.newPage();

  jobs[jobId].status = "opening_chatgpt";

  await page.goto("https://chatgpt.com", {
    waitUntil: "domcontentloaded",
    timeout: 60000
  });

  await page.waitForTimeout(5000);

  jobs[jobId].status = "uploading_files";
  await uploadFiles(page, files);

  await page.waitForTimeout(8000);

  const prompt = `
${data.prompt}

Referans görsel yüklendi.
PUSULA SPOR logosu yüklendiyse onu marka referansı olarak kullan.

Kurallar:
- Referans görselin kalitesini, ışığını, kompozisyonunu ve premium spor medya hissini koru.
- De Marke yazısı, logosu, footer'ı veya watermark varsa kaldır.
- PUSULA SPOR markasına uygun özgün bir futbol medya posteri üret.
- Logo bozulmasın.
- Yazılar taşmasın.
- Amatör veya yapay görünmesin.
- Premium, gerçekçi, editorial spor posteri kalitesinde olsun.

Haber başlığı:
${data.title}
`;

  jobs[jobId].status = "sending_prompt";
  await fillPrompt(page, prompt);
  await page.keyboard.press("Enter");

  jobs[jobId].status = "waiting_image";

  const finalPath = path.join(jobDir, "final.png");
  await waitAndScreenshotGeneratedImage(page, finalPath);

  jobs[jobId].status = "done";
  jobs[jobId].imageUrl = `/file/${jobId}/final.png`;

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

  res.json({ status: "processing", jobId });

  createWithChatGPT(jobId, req.body).catch(err => {
    jobs[jobId].status = "error";
    jobs[jobId].error = err.message;
  });
});

app.get("/result/:jobId", (req, res) => {
  const job = jobs[req.params.jobId];

  if (!job) return res.json({ status: "not_found" });

  const baseUrl = `${req.protocol}://${req.get("host")}`;

  res.json({
    status: job.status,
    imageUrl: job.imageUrl ? `${baseUrl}${job.imageUrl}` : null,
    error: job.error
  });
});

app.get("/file/:jobId/:filename", (req, res) => {
  const filePath = path.join(OUT_DIR, req.params.jobId, req.params.filename);

  if (!fs.existsSync(filePath)) {
    return res.status(404).send("File not found");
  }

  res.sendFile(filePath);
});

app.listen(3000, "0.0.0.0", () => {
  console.log("Local worker running on 3000");
});
