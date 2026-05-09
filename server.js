const express = require("express");
const fs = require("fs");
const path = require("path");
const axios = require("axios");

const app = express();
app.use(express.json({ limit: "20mb" }));

const jobs = {};
const OUT_DIR = path.join(__dirname, "outputs");

if (!fs.existsSync(OUT_DIR)) {
  fs.mkdirSync(OUT_DIR);
}

async function downloadFile(url, filepath) {
  const response = await axios({
    method: "GET",
    url,
    responseType: "arraybuffer",
  });

  fs.writeFileSync(filepath, response.data);
}

app.post("/create-image", async (req, res) => {
  const jobId = Date.now().toString();

  const {
    title,
    tweetUrl,
    sourceImageUrl,
    logoUrl,
    prompt
  } = req.body;

  jobs[jobId] = {
    status: "processing",
    title,
    tweetUrl,
    sourceImageUrl,
    logoUrl,
    prompt,
    imageUrl: null,
    error: null,
  };

  res.json({
    status: "processing",
    jobId,
  });

  try {
    const jobDir = path.join(OUT_DIR, jobId);
    fs.mkdirSync(jobDir, { recursive: true });

    const sourcePath = path.join(jobDir, "source.jpg");

    await downloadFile(sourceImageUrl, sourcePath);

    if (logoUrl) {
      const logoPath = path.join(jobDir, "logo.png");
      await downloadFile(logoUrl, logoPath);
    }

    // Şimdilik test için source görseli final gibi döndürüyoruz.
    jobs[jobId].status = "done";
    jobs[jobId].imageUrl = `/file/${jobId}/source.jpg`;

  } catch (err) {
    jobs[jobId].status = "error";
    jobs[jobId].error = err.message;
  }
});

app.get("/result/:jobId", (req, res) => {
  const job = jobs[req.params.jobId];

  if (!job) {
    return res.status(404).json({ status: "not_found" });
  }

  const baseUrl = `${req.protocol}://${req.get("host")}`;

  res.json({
    status: job.status,
    imageUrl: job.imageUrl ? `${baseUrl}${job.imageUrl}` : null,
    error: job.error,
  });
});

app.get("/file/:jobId/:filename", (req, res) => {
  const filePath = path.join(OUT_DIR, req.params.jobId, req.params.filename);

  if (!fs.existsSync(filePath)) {
    return res.status(404).send("File not found");
  }

  res.sendFile(filePath);
});

app.listen(process.env.PORT || 3000, () => {
  console.log("Worker running");
});
