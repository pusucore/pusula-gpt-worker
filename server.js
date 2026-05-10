async function downloadGeneratedImageFromButton(page, outputPath) {
  const timeout = Date.now() + 1000 * 60 * 8;

  while (Date.now() < timeout) {
    const downloadButtons = page.locator(
      "button[aria-label*='Download'], button[aria-label*='İndir'], a[download]"
    );

    const count = await downloadButtons.count();

    if (count > 0) {
      const btn = downloadButtons.nth(count - 1);

      const downloadPromise = page.waitForEvent("download", { timeout: 30000 });
      await btn.click();

      const download = await downloadPromise;
      await download.saveAs(outputPath);
      return;
    }

    await page.waitForTimeout(5000);
  }

  throw new Error("Download button not found");
}
