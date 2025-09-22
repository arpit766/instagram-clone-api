// server.js
const express = require("express");
const bodyParser = require("body-parser");
const pool = require("./db"); // db.js connection pool

const app = express();
app.use(bodyParser.json());

/**
 * Utility function for pagination
 */
function getPagination(req) {
  const page = parseInt(req.query.page) || 1;
  const limit = parseInt(req.query.limit) || 10;
  const offset = (page - 1) * limit;
  return { limit, offset };
}

/**
 * 1. Get Home Feed
 * GET /api/feed?user_id={id}&page=1&limit=10
 */
app.get("/api/feed", async (req, res) => {
  const { user_id } = req.query;
  const { limit, offset } = getPagination(req);

  if (!user_id) return res.status(400).json({ error: "user_id is required" });

  try {
    // Check if user exists
    const [user] = await pool.query("SELECT user_id FROM Users WHERE user_id = ?", [user_id]);
    if (user.length === 0) return res.status(404).json({ error: "User not found" });

    const [rows] = await pool.query(
      `
      SELECT p.post_id, p.user_id, u.username, u.profile_pic_url, 
             p.media_url, p.caption, p.media_type, p.created_at,
             (SELECT COUNT(*) FROM Likes l WHERE l.post_id = p.post_id) as like_count,
             (SELECT COUNT(*) FROM Comments c WHERE c.post_id = p.post_id) as comment_count,
             EXISTS(SELECT 1 FROM Likes l WHERE l.post_id = p.post_id AND l.user_id = ?) as is_liked
      FROM Posts p
      JOIN Users u ON p.user_id = u.user_id
      WHERE p.user_id IN (
        SELECT following_id FROM Followers WHERE follower_id = ?
        UNION SELECT ? -- user’s own posts
      )
      ORDER BY p.created_at DESC
      LIMIT ? OFFSET ?
      `,
      [user_id, user_id, user_id, limit, offset]
    );

    if (rows.length === 0) {
      return res.status(200).json({ feed: [], message: "No posts available" });
    }

    res.json({ feed: rows });
  } catch (err) {
    console.error("Feed API error:", err);
    res.status(500).json({ error: "Failed to fetch feed" });
  }
});

/**
 * 2. Get Stories
 * GET /api/stories?user_id={id}
 */
app.get("/api/stories", async (req, res) => {
  const { user_id } = req.query;
  if (!user_id) return res.status(400).json({ error: "user_id is required" });

  try {
    const [user] = await pool.query("SELECT user_id FROM Users WHERE user_id = ?", [user_id]);
    if (user.length === 0) return res.status(404).json({ error: "User not found" });

    const [rows] = await pool.query(
      `
      SELECT s.story_id, s.user_id, u.username, u.profile_pic_url,
             s.media_url, s.created_at, s.expires_at
      FROM Stories s
      JOIN Users u ON s.user_id = u.user_id
      WHERE s.user_id IN (
        SELECT following_id FROM Followers WHERE follower_id = ?
        UNION SELECT ? -- user’s own story
      )
      AND s.expires_at > NOW()
      ORDER BY s.created_at DESC
      `,
      [user_id, user_id]
    );

    if (rows.length === 0) {
      return res.status(200).json({ stories: [], message: "No active stories" });
    }

    res.json({ stories: rows });
  } catch (err) {
    console.error("Stories API error:", err);
    res.status(500).json({ error: "Failed to fetch stories" });
  }
});

/**
 * 3. Like / Unlike Post
 * POST /api/posts/:post_id/like
 */
app.post("/api/posts/:post_id/like", async (req, res) => {
  const { post_id } = req.params;
  const { user_id } = req.body;

  if (!user_id) return res.status(400).json({ error: "user_id is required" });

  try {
    const [post] = await pool.query("SELECT post_id FROM Posts WHERE post_id = ?", [post_id]);
    if (post.length === 0) return res.status(404).json({ error: "Post not found" });

    const [user] = await pool.query("SELECT user_id FROM Users WHERE user_id = ?", [user_id]);
    if (user.length === 0) return res.status(404).json({ error: "User not found" });

    const [existing] = await pool.query(
      "SELECT * FROM Likes WHERE post_id = ? AND user_id = ?",
      [post_id, user_id]
    );

    if (existing.length > 0) {
      await pool.query("DELETE FROM Likes WHERE post_id = ? AND user_id = ?", [post_id, user_id]);
      return res.status(200).json({ message: "Post unliked successfully" });
    } else {
      await pool.query(
        "INSERT INTO Likes (post_id, user_id, created_at) VALUES (?, ?, NOW())",
        [post_id, user_id]
      );
      return res.status(201).json({ message: "Post liked successfully" });
    }
  } catch (err) {
    console.error("Like API error:", err);
    res.status(500).json({ error: "Failed to process like/unlike" });
  }
});

/**
 * 4. Comment on Post
 * POST /api/posts/:post_id/comment
 */
app.post("/api/posts/:post_id/comment", async (req, res) => {
  const { post_id } = req.params;
  const { user_id, text } = req.body;

  if (!user_id || !text) return res.status(400).json({ error: "user_id and text are required" });

  try {
    const [post] = await pool.query("SELECT post_id FROM Posts WHERE post_id = ?", [post_id]);
    if (post.length === 0) return res.status(404).json({ error: "Post not found" });

    const [user] = await pool.query("SELECT user_id FROM Users WHERE user_id = ?", [user_id]);
    if (user.length === 0) return res.status(404).json({ error: "User not found" });

    const [result] = await pool.query(
      "INSERT INTO Comments (post_id, user_id, text, created_at) VALUES (?, ?, ?, NOW())",
      [post_id, user_id, text]
    );

    res.status(201).json({ message: "Comment added successfully", comment_id: result.insertId });
  } catch (err) {
    console.error("Comment API error:", err);
    res.status(500).json({ error: "Failed to add comment" });
  }
});

/**
 * 5. Get Reels
 * GET /api/reels?user_id={id}&page=1&limit=10
 */
app.get("/api/reels", async (req, res) => {
  const { user_id } = req.query;
  const { limit, offset } = getPagination(req);

  if (!user_id) return res.status(400).json({ error: "user_id is required" });

  try {
    const [user] = await pool.query("SELECT user_id FROM Users WHERE user_id = ?", [user_id]);
    if (user.length === 0) return res.status(404).json({ error: "User not found" });

    const [rows] = await pool.query(
      `
      SELECT p.post_id, p.user_id, u.username, u.profile_pic_url, 
             p.media_url, p.caption, p.media_type, p.created_at,
             (SELECT COUNT(*) FROM Likes l WHERE l.post_id = p.post_id) as like_count,
             (SELECT COUNT(*) FROM Comments c WHERE c.post_id = p.post_id) as comment_count,
             EXISTS(SELECT 1 FROM Likes l WHERE l.post_id = p.post_id AND l.user_id = ?) as is_liked
      FROM Posts p
      JOIN Users u ON p.user_id = u.user_id
      WHERE p.media_type = 'reel'
      ORDER BY p.created_at DESC
      LIMIT ? OFFSET ?
      `,
      [user_id, limit, offset]
    );

    if (rows.length === 0) {
      return res.status(200).json({ reels: [], message: "No reels available" });
    }

    res.json({ reels: rows });
  } catch (err) {
    console.error("Reels API error:", err);
    res.status(500).json({ error: "Failed to fetch reels" });
  }
});

/**
 * Start server
 */
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`✅ Server running on http://localhost:${PORT}`);
});

