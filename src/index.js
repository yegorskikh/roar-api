import express from "express";
import helmet from "helmet";
import rateLimit from "express-rate-limit";

const app = express();

const port = process.env.API_PORT || 3000;
const publicApiKey = process.env.PUBLIC_API_KEY;
const libreTranslateUrl = process.env.LIBRETRANSLATE_URL || "http://libretranslate:5000";

app.use(helmet());
app.use(express.json({ limit: "10kb" }));

const translateLimiter = rateLimit({
  windowMs: 60 * 1000,
  limit: 60,
  standardHeaders: true,
  legacyHeaders: false
});

function requireApiKey(req, res, next) {
  const apiKey = req.header("X-Smart-Trex-Key");

  if (!publicApiKey || apiKey !== publicApiKey) {
    return res.status(401).json({
      error: "Unauthorized"
    });
  }

  next();
}

app.get("/health", (_, res) => {
  res.json({
    status: "ok"
  });
});

app.get("/api/languages", requireApiKey, async (_, res) => {
  try {
    const response = await fetch(`${libreTranslateUrl}/languages`);
    const data = await response.json();

    if (!response.ok) {
      return res.status(response.status).json({
        error: "Translation provider error",
        details: data
      });
    }

    return res.json(data);
  } catch (error) {
    console.error(error);

    return res.status(500).json({
      error: "Internal server error"
    });
  }
});

app.post("/api/translate", requireApiKey, translateLimiter, async (req, res) => {
  try {
    const { text, source = "auto", target = "ru" } = req.body;

    if (!text || typeof text !== "string") {
      return res.status(400).json({
        error: "Text is required"
      });
    }

    const normalizedText = text.trim();

    if (normalizedText.length === 0) {
      return res.status(400).json({
        error: "Text is empty"
      });
    }

    if (normalizedText.length > 1000) {
      return res.status(400).json({
        error: "Text is too long"
      });
    }

    const response = await fetch(`${libreTranslateUrl}/translate`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        q: normalizedText,
        source,
        target,
        format: "text"
      })
    });

    const data = await response.json();

    if (!response.ok) {
      return res.status(response.status).json({
        error: "Translation provider error",
        details: data
      });
    }

    return res.json({
      originalText: normalizedText,
      translatedText: data.translatedText,
      source,
      target
    });
  } catch (error) {
    console.error(error);

    return res.status(500).json({
      error: "Internal server error"
    });
  }
});

app.listen(port, () => {
  console.log(`Smart-Trex API started on port ${port}`);
});
