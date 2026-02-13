
// imported packages for Node.js
const express = require("express");       // server dev package
const Parser = require("rss-parser");     // parsing url rss/xml package
const cors = require("cors");

// create cost instances 
const app = express();                     // express-based server app
const parser = new Parser();               // RSS parser
const PORT = process.env.PORT || 3000;     // server port
const FEED_URL = "https://backfeed.app/jkLTDA9LpqPBIVdrjl/https://grantmagazine.com/feed/rss"; // fetching URL for magazine data

// cache setup to prevent constant requests, stores fetched rss feed in the cache
let cachedFeed = null;
let lastFetch = 0;
const CACHE_INTERVAL = 15 * 60 * 1000; // 15 minute intervals

app.use(cors());

app.get("/feed", async (req, res) => { // feed get function
  const now = Date.now();

  if (!cachedFeed || now - lastFetch > CACHE_INTERVAL) { // cacher for paced requests
    try {
      const response = await fetch(FEED_URL, {
        headers: {
          "User-Agent": "Mozilla/5.0 (compatible; GrantMagBot/1.0)" // header to avoid bot blocks
        }
      });

      cachedFeed = await response.text();
      lastFetch = now;
    } 
    
    catch (e) { // error catch
      console.error("RSS fetch error:", e);
      return res.status(500).send("");
    }
  }

  res.set("Content-Type", "application/rss+xml");
  res.send(cachedFeed); // send to client
});

app.get("/", (req, res) => res.send("GrantMag backend is running!")); // server health check

app.listen(PORT, () => console.log(`Server running on port ${PORT}`)); // port check





