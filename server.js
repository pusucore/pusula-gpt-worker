const express = require("express");

const app = express();

app.get("/", (req, res) => {
  res.status(200).send("OK");
});

app.get("/result/:jobId", (req, res) => {
  res.json({ status: "not_found" });
});

const port = process.env.PORT || 3000;

app.listen(port, () => {
  console.log(`Listening on ${port}`);
});
