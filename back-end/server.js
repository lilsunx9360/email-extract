import express from 'express';
import cors from 'cors';
import axios from 'axios';
import * as cheerio from 'cheerio';
import multer from 'multer';
import xlsx from 'xlsx';
import validator from 'email-validator';
import puppeteer from 'puppeteer';
import dotenv from 'dotenv';
dotenv.config();
const app = express();
const PORT = process.env.PORT || 5000;

// Configure multer for file uploads
const upload = multer({ storage: multer.memoryStorage() });

app.use(cors());
app.use(express.json());

// Endpoint to handle Excel file upload and scrape emails
app.post('/scrape-emails', upload.single('file'), async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ error: 'No Excel file uploaded' });
    }

    // Read the Excel file
    const workbook = xlsx.read(req.file.buffer, { type: 'buffer' });
    const sheetName = workbook.SheetNames[0];
    const sheet = workbook.Sheets[sheetName];
    const domains = xlsx.utils.sheet_to_json(sheet, { header: 1 }).flat();

    // Normalize and deduplicate domains
    const validDomains = [...new Set(domains
      .filter(domain => typeof domain === 'string' && domain.trim().length > 0)
      .map(domain => {
        domain = domain.trim();
        return !/^https?:\/\//i.test(domain) ? `https://${domain}` : domain.replace(/^http:/, 'https:');
      }))];

    if (validDomains.length === 0) {
      return res.status(400).json({ error: 'No valid domains found in the Excel file' });
    }

    // Email regex
    const emailRegex = /[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-z]{2,}(?!\S*[@])/g;

    // Invalid email patterns (relaxed to avoid over-filtering)
    const invalidEmailPatterns = [
      /@example\.com$/i,
      /@test\.com$/i,
      /@gmail\.com$/i,
      /@yahoo\.com$/i,
      /@hotmail\.com$/i,
      /@2x/i,
      /@.*\.(jpg|png|gif|jpeg|svg|webp)$/i
    ];

    const allEmails = [];
    const debugInfo = []; // Store debugging info for each domain
    const browser = await puppeteer.launch({ headless: true });

    // Scrape emails from each domain
    for (const url of validDomains) {
      const domainDebug = { url, status: 'success', emailsFound: [], emailsFiltered: [], error: null };

      // Try multiple pages (homepage and /contact)
      const pagesToScrape = [url, `${url.replace(/\/$/, '')}/contact`];
      let emails = [];

      for (const pageUrl of pagesToScrape) {
        try {
          console.log(`Scraping ${pageUrl}`);

          // Try axios/cheerio first
          try {
            const response = await axios.get(pageUrl, {
              headers: {
                'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36'
              },
              timeout: 10000
            });

            const $ = cheerio.load(response.data);
            const textSources = [
              $('a[href^="mailto:"]').map((i, el) => $(el).attr('href').replace('mailto:', '')).get(),
              $('body').find('p, div, footer, .contact, .footer, .email, .contact-us').text()
            ].flat().join(' ');

            emails.push(...(textSources.match(emailRegex) || []));
            domainDebug.emailsFound.push(...(textSources.match(emailRegex) || []));
          } catch (axiosError) {
            console.log(`Axios failed for ${pageUrl}: ${axiosError.message}, trying Puppeteer...`);

            // Fallback to Puppeteer
            const page = await browser.newPage();
            await page.setUserAgent('Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36');
            try {
              await page.goto(pageUrl, { waitUntil: 'networkidle2', timeout: 15000 });
              const content = await page.evaluate(() => document.body.innerText);
              const mailtoLinks = await page.$$eval('a[href^="mailto:"]', links => 
                links.map(link => link.href.replace('mailto:', '')));
              emails.push(...(content.match(emailRegex) || []), ...mailtoLinks);
              domainDebug.emailsFound.push(...(content.match(emailRegex) || []), ...mailtoLinks);
              await page.close();
            } catch (puppeteerError) {
              console.error(`Puppeteer failed for ${pageUrl}: ${puppeteerError.message}`);
              continue;
            }
          }
        } catch (err) {
          domainDebug.status = 'failed';
          domainDebug.error = err.message;
          console.error(`Error scraping ${pageUrl}: ${err.message}`);
          continue;
        }
      }

      // Filter valid emails
      const validEmails = emails
        .filter(email => {
          if (!email || typeof email !== 'string') return false;
          const isValid = validator.validate(email);
          const isNotInvalid = !invalidEmailPatterns.some(pattern => pattern.test(email));
          if (!isValid || !isNotInvalid) {
            domainDebug.emailsFiltered.push(email);
          }
          return isValid && isNotInvalid;
        })
        .map(email => email.toLowerCase());

      if (validEmails.length > 0) {
        allEmails.push(...validEmails);
      }

      debugInfo.push(domainDebug);

      // Delay to prevent rate limiting
      await new Promise(resolve => setTimeout(resolve, 2000));
    }

    await browser.close();

    // Remove duplicates
    const uniqueEmails = [...new Set(allEmails)];

    // Include debug info in response for troubleshooting
    res.json({
      emails: uniqueEmails,
      message: uniqueEmails.length === 0 ? 'No valid emails found' : 'Emails scraped successfully',
      debug: debugInfo
    });
  } catch (err) {
    console.error(`Server error: ${err.message}`);
    res.status(500).json({ error: 'Failed to process the request', debug: [] });
  }
});

app.listen(PORT, () => {
  console.log(`Server running at http://localhost:${PORT}`);
});