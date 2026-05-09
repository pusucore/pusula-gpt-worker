const express = require("express");

const app = express();

app.get("/", (req, res) => {
  res.status(200).send("OK");
});

app.get("/result/:jobId", (req, res) => {
  res.json({ status: "not_found" });
});

app.listen(3000, "0.0.0.0", () => {
  console.log("Listening on 3000");
});
