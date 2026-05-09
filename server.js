const express = require("express");
const axios = require("axios");
const fs = require("fs");
const path = require("path");

const app = express();
app.use(express.json({ limit: "20mb" }));

const jobs = {};
const OUT_DIR = path.join(__dirname, "outputs");

if (!fs.existsSync(OUT_DIR)) {
  fs.mkdirSync(OUT_DIR, { recursive: true });
}

async function downloadFile(url, filepath) {
  const response = await axios.get(url, {
    responseType: "arraybuffer",
    headers: {
      "User-Agent": "Mozilla/5.0"
    }
  });

  fs.writeFileSync(filepath, response.data);
}

app.get("/", (req, res) => {
  res.status(200).send("OK");
});

app.post("/create-image", async (req, res) => {
  const jobId = Date.now().toString();
  const { title, sourceImageUrl, prompt } = req.body;

  jobs[jobId] = {
    status: "processing",
    title,
    sourceImageUrl,
    prompt,
    imageUrl: null,
    error: null
  };

  res.json({
    status: "processing",
    jobId
  });

  try {
    const jobDir = path.join(OUT_DIR, jobId);
    fs.mkdirSync(jobDir, { recursive: true });

    const sourcePath = path.join(jobDir, "source.jpg");
    await downloadFile(sourceImageUrl, sourcePath);

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
    return res.json({ status: "not_found" });
  }

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
  console.log("Listening on 3000");
});
