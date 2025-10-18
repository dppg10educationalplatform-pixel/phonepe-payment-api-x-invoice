import express from "express";
import fetch from "node-fetch";
import dotenv from "dotenv";
import cors from "cors";

dotenv.config();
const app = express();
app.use(cors());
app.use(express.json());

// Load environment variables
const CLIENT_ID = process.env.CLIENT_ID;
const CLIENT_SECRET = process.env.CLIENT_SECRET;
const REDIRECT_URL = process.env.REDIRECT_URL;
const PORT = process.env.PORT || 5000;

// ------------------- AUTH TOKEN API -------------------
app.get("/auth", async (req, res) => {
  try {
    const response = await fetch(
      "https://api-preprod.phonepe.com/apis/pg-sandbox/v1/oauth/token",
      {
        method: "POST",
        headers: { "Content-Type": "application/x-www-form-urlencoded" },
        body: new URLSearchParams({
          client_id: CLIENT_ID,
          client_secret: CLIENT_SECRET,
          client_version: "1",
          grant_type: "client_credentials",
        }),
      }
    );

    const data = await response.json();
    res.json(data);
  } catch (err) {
    console.error("Error fetching token:", err);
    res.status(500).json({ error: "Failed to fetch auth token" });
  }
});

// ------------------- PAYMENT INIT API -------------------
app.post("/create-payment", async (req, res) => {
  try {
    const { merchantOrderId, amount } = req.body;

    // Get a fresh access token first
    const tokenResponse = await fetch(
      "https://api-preprod.phonepe.com/apis/pg-sandbox/v1/oauth/token",
      {
        method: "POST",
        headers: { "Content-Type": "application/x-www-form-urlencoded" },
        body: new URLSearchParams({
          client_id: CLIENT_ID,
          client_secret: CLIENT_SECRET,
          client_version: "1",
          grant_type: "client_credentials",
        }),
      }
    );

    const tokenData = await tokenResponse.json();
    const accessToken = tokenData.access_token;

    // Create payment
    const payResponse = await fetch(
      "https://api-preprod.phonepe.com/apis/pg-sandbox/checkout/v2/pay",
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `O-Bearer ${accessToken}`,
        },
        body: JSON.stringify({
          merchantOrderId: merchantOrderId || "TX" + Date.now(),
          amount: amount || 1000, // amount in paisa (e.g., 1000 = ₹10)
          expireAfter: 1200,
          paymentFlow: {
            type: "PG_CHECKOUT",
            message: "Payment message used for collect requests",
            merchantUrls: {
              redirectUrl: REDIRECT_URL,
            },
          },
        }),
      }
    );

    const payData = await payResponse.json();
    res.json(payData);
  } catch (err) {
    console.error("Error creating payment:", err);
    res.status(500).json({ error: "Payment creation failed" });
  }
});

// ------------------- DEFAULT ROUTE -------------------
app.get("/", (req, res) => {
  res.send("✅ PhonePe Payment API is running successfully!");
});

// ------------------- START SERVER -------------------
app.listen(PORT, () => {
  console.log(`🚀 Server running on port ${PORT}`);
});
