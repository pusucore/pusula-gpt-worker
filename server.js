const express = require("express");

const app = express();

app.use(express.json());

const jobs = {};

app.get("/", (req, res) => {
  res.status(200).send("OK");
});

app.post("/create-image", async (req, res) => {

  const jobId = Date.now().toString();

  jobs[jobId] = {
    status: "done",
    imageUrl: "https://picsum.photos/1024"
  };

  res.json({
    status: "processing",
    jobId
  });

});

app.get("/result/:jobId", (req, res) => {

  const job = jobs[req.params.jobId];

  if (!job) {
    return res.json({
      status: "not_found"
    });
  }

  res.json(job);

});

app.listen(3000, "0.0.0.0", () => {
  console.log("Listening on 3000");
});
