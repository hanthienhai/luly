import { chromium } from 'playwright';
import fs from 'fs';
import path from 'path';

const urls = [
  { url: 'https://www.luly.vn/', folder: 'home' },
  { url: 'https://www.luly.vn/wedding/pre-wedding', folder: 'pre-wedding' },
  { url: 'https://www.luly.vn/wedding/wedding-day', folder: 'wedding-day' },
  { url: 'https://www.luly.vn/concept', folder: 'concept' },
  { url: 'https://www.luly.vn/gi%E1%BB%9Bi-thi%E1%BB%87u', folder: 'gioi-thieu' },
  { url: 'https://www.luly.vn/ảnh/indoor', folder: 'indoor' },
  { url: 'https://www.luly.vn/ảnh/outdoor', folder: 'outdoor' }
];

(async () => {
  const browser = await chromium.launch();
  const page = await browser.newPage();
  
  for (const item of urls) {
    console.log(`Scraping: ${item.url}`);
    await page.goto(item.url, { waitUntil: 'networkidle', timeout: 60000 });
    
    // Scroll down to potentially lazy-loaded images
    await page.evaluate(async () => {
        await new Promise((resolve) => {
            let totalHeight = 0;
            const distance = 400;
            const timer = setInterval(() => {
                const scrollHeight = document.body.scrollHeight;
                window.scrollBy(0, distance);
                totalHeight += distance;

                if(totalHeight >= scrollHeight){
                    clearInterval(timer);
                    resolve();
                }
            }, 100);
        });
    });
    
    await page.waitForTimeout(2000);

    const imgUrls = await page.evaluate(() => {
      const imgs = Array.from(document.querySelectorAll('img'));
      return imgs.map(img => img.src).filter(src => src && !src.startsWith('data:'));
    });
    
    // Use Set to make them unique
    const uniqueImgUrls = [...new Set(imgUrls)];
    
    console.log(`Found ${uniqueImgUrls.length} images on ${item.folder}. Downloading...`);
    
    const folderPath = path.join(process.cwd(), 'src', 'assets', 'images', item.folder);
    if (!fs.existsSync(folderPath)) {
      fs.mkdirSync(folderPath, { recursive: true });
    }
    
    let cnt = 1;
    for (const imgUrl of uniqueImgUrls) {
      try {
        // Many Google sites images have `=w1200-h800...` query params. Try to remove them for full res?
        // Let's just download what we get for now.
        let finalUrl = imgUrl;
        if(imgUrl.includes('=w')){
           finalUrl = imgUrl.split('=w')[0] + '=s0'; // =s0 gets original size in google image servers usually
        }

        const response = await fetch(finalUrl);
        const buffer = await response.arrayBuffer();
        if (buffer.byteLength > 10000) { // filter out tiny icons
            const ext = finalUrl.toLowerCase().includes('.png') ? '.png' : '.jpg';
            const fileName = `img-${cnt}${ext}`;
            fs.writeFileSync(path.join(folderPath, fileName), Buffer.from(buffer));
            cnt++;
        }
      } catch (err) {
        console.error("Error downloading ", imgUrl, err.message);
      }
    }
  }
  
  await browser.close();
})();
