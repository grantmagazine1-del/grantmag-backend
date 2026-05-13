console.log("ENV CHECK:", Object.keys(process.env).filter(k => k.includes("FIREBASE")));

// imported packages for Node.js
const express = require("express");       // server dev package
const Parser = require("rss-parser");     // parsing url rss/xml package
const cors = require("cors");

// create cost instances 
const app = express();                     // express-based server app
const parser = new Parser();               // RSS parser
const PORT = process.env.PORT || 3000;     // server port
const FEED_URL = "https://grantmagazine.com/feed/"; // fetching URL for magazine data

let lastSeenArticleID = null;

const admin = require("firebase-admin"); // firebase admin for push notif
admin.initializeApp({
  credential: admin.credential.cert({
    projectId: process.env.FIREBASE_PROJ_ID,
    clientEmail: process.env.FIREBASE_CLIENT_EMAIL,
    privateKey: process.env.FIREBASE_PRIV_KEY.replace(/\\n/g, '\n'),
  })
});

const db = admin.firestore();
const messaging = admin.messaging();

app.use(cors()); // cors for browser testing security

let cachedFeed = null;
let lastFeedFetch = 0;
const FEED_CACHE_INTERVAL = 15 * 60 * 1000; // 15 min interval

setInterval(() => {
  checkRSSUpdates();
}, 60 * 1000); // 1 min interval

app.get("/feed", async (req, res) => {
  const now = Date.now();

  // cache setup to prevent constant requests, stores fetched rss feed in the cache
  if (!cachedFeed || now - lastFeedFetch > FEED_CACHE_INTERVAL) { // if >15 min since last fetch, fetch feed.
    try {
      const response = await fetch(FEED_URL, {
        headers: {
          "User-Agent":
            "Mozilla/5.0 (compatible; GrantMagBot/1.0)" // bot header syntax
        }
      });

      cachedFeed = await response.text();
      lastFeedFetch = now;

      console.log("RSS refreshed at", new Date().toISOString());
    } 
    
    catch (e) {
      console.error("RSS fetch error:", e);
      return res.status(500).send("");
    }
  }

  res.set("Content-Type", "application/rss+xml");
  res.send(cachedFeed);
});

// seperate article cache for simplicity
let articleCache = {};
const ARTICLE_CACHE_INTERVAL = 60 * 1000; // 1 min interval

app.get("/article", async (req, res) => {
  const url = req.query.url;

  if (!url) {
    return res.status(400).send("Missing url parameter");
  }

  // basic security: only allows grantmagazine domain
  if (!url.startsWith("https://grantmagazine.com/")) {
    return res.status(403).send("Forbidden domain");
  }

  const now = Date.now();

  // same caching logic
  if (
    articleCache[url] &&
    now - articleCache[url].timestamp < ARTICLE_CACHE_INTERVAL
  ) {
    console.log("Serving cached article:", url);
    res.set("Content-Type", "text/html");
    return res.send(articleCache[url].html);
  }

  try {
    const response = await fetch(url, {
      headers: {
        "User-Agent":
          "Mozilla/5.0 (compatible; GrantMagBot/1.0)"
      }
    });

    let html = await response.text();

    // save to cache
    articleCache[url] = {
      html,
      timestamp: now
    };

    console.log("Fetched new article:", url);
    // html cleanup
    html = html.replace(/<img[^>]+src="([^"]+)"/g, (match, src) => {
      const proxied = `https://grantmag-backend-production.up.railway.app/image?url=${encodeURIComponent(src)}`;
      return match.replace(src, proxied);
    });

    res.set("Content-Type", "text/html");
    res.send(html);

  } catch (e) {
    console.error("Article fetch error:", e);
    res.status(500).send("");
  }
});

async function sendPush(article) { // push notifications func
  const message = {
    notification: {
      title: article.title || "New Article",
      body: article.contentSnippet || "Tap to read",
    },
    data: {
      url: article.link || "",
    },
    topic: "news", // temp placeholder, could utilize tokens
  };

  try {
    const res = await messaging.send(message);
    console.log("Push sent:", res);
  } catch (err) {
    console.error("Push failed:", err);
  }
}

async function checkRSSUpdates() { // monitor feed for new articles, then pushes notif
  try {
    const feed = await parser.parseURL(FEED_URL);

    const latest = feed.items?.[0];

    if (!latest) return;

    const latestId = latest.guid || latest.link || latest.pubDate;

    if (!lastSeenArticleId) {
      lastSeenArticleId = latestId;
      console.log("Initialized RSS state");
      return;
    }

    if (latestId !== lastSeenArticleId) {
      console.log("NEW ARTICLE DETECTED:", latest.title);

      lastSeenArticleId = latestId;

      await sendPush(latest);
    }

  } catch (err) {
    console.error("RSS check failed:", err);
  }
}

app.get("/test-push", async (req, res) => { // test push for notifs
  try {
    await messaging.send({
      topic: "news",
      notification: {
        title: "Test Push",
        body: "Backend is running locally",
      },
    });
    console.log("Test push sent");
    res.send("OK");
  } catch (err) {
    console.error(err);
    res.status(500).send("Error sending push");
  }
});

app.get("/", (req, res) => res.send("GrantMag backend is running!")); // server health check

app.listen(PORT, () => console.log(`Server running on port ${PORT}`)); // port check





