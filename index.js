
// imported packages for Node.js
const express = require("express");       // server dev package
const Parser = require("rss-parser");     // parsing url rss/xml package
const cheerio = require("cheerio");       // HTML scrape package

// create cost instances 
const app = express();                     // express-based server app
const parser = new Parser();               // RSS parser
const PORT = process.env.PORT || 3000;     // server port
const FEED_URL = "https://backfeed.app/jkLTDA9LpqPBIVdrjl/https://grantmagazine.com/feed/rss"; // fetching URL for magazine data

// cache setup to prevent constant requests, stores fetched rss feed in the cache
let cachedFeed = null;
let lastFetch = 0;
const CACHE_INTERVAL = 15 * 60 * 1000; // 15 minute intervals

app.get("/feed", async (req, res) => { // app.get handles get requests for feed
  const now = Date.now();

  // check cache interval
  if (!cachedFeed || now - lastFetch > CACHE_INTERVAL) {
    try {
      const response = await fetch(FEED_URL, {
        headers: {
            "User-Agent": "Mozilla/5.0 (compatible; GrantMagBot/1.0)"
        }
    });
       // RSS xml fetch
      const xml = await response.text();
      console.log(response); // converted fetched obj to txt
      const feed = await parser.parseString(xml);   // parses txt to a string json

      // stores the necessary items from the parsed feed
    cachedFeed = feed.items.map(item => ({
        title: item.title,
        link: item.link,
        categories: item.categories,
        content: item.content || item.description || '', // keep HTML intact
        }));


      lastFetch = now;  // updates fetch
    } 
    
    catch (e) { // error catch
      console.error("RSS fetch error:", e);
      return res.status(500).json({ items: [] });
    }
  }

  res.json({ items: cachedFeed }); // returns the feed json
});

async function getFeaturedImage(url) { // featured image function
  try {
    const response = await fetch(url);
    const html = await response.text();
    const $ = cheerio.load(html);  // loads html version of feed with cheerio

    const ogImage = $('meta[property="og:image"]').attr("content"); // parameter search
    if (ogImage) return ogImage;

    const photo = $(".photowrap img").attr("src"); // parameter search
    return photo || null;
  } 
  
  catch (e) {
    console.error("Image scrape error:", e);
    return null;
  }
}

app.get("/article", async (req, res) => { // get function for featured images
  const url = req.query.url;
  if (!url) return res.status(400).json({ error: "Missing url" });

  const image = await getFeaturedImage(url);
  res.json({ featuredImage: image });
});

app.get("/", (req, res) => res.send("GrantMag backend is running!")); // server health check

app.listen(PORT, () => console.log(`Server running on port ${PORT}`)); // port check





