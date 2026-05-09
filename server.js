const express = require('express');

const app = express();

app.use(express.json());

app.post('/create-image', async (req, res) => {

  const {
    title,
    prompt,
    sourceImageUrl,
    logoUrl
  } = req.body;

  console.log('JOB:', title);

  // Şimdilik fake response
  // sonra playwright bağlayacağız

  return res.json({
    status: 'processing',
    jobId: Date.now().toString()
  });

});

app.get('/result/:id', async (req, res) => {

  return res.json({
    status: 'done',
    imageUrl: 'https://dummyimage.com/1024x1024'
  });

});

app.listen(3000, () => {
  console.log('Worker running');
});
