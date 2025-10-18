import express from "express";
import fetch from "node-fetch";
import dotenv from "dotenv";
import cors from "cors";
import path from "path";
import { fileURLToPath } from "url";

dotenv.config();

const app = express();
app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// __dirname for ES module
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Serve static HTML & assets
app.use(express.static(path.join(__dirname, "public")));

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
app.post("/pay", async (req, res) => {
  try {
    const { amount } = req.body;

    // Get fresh access token
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
          merchantOrderId: "TX" + Date.now(),
          amount: amount || 1000, // in paisa
          expireAfter: 1200,
          paymentFlow: {
            type: "PG_CHECKOUT",
            message: "Payment message used for collect requests",
            merchantUrls: { redirectUrl: REDIRECT_URL },
          },
        }),
      }
    );

    const payData = await payResponse.json();

    if (payData?.status === "SUCCESS" || payData?.data?.paymentUrl) {
      res.json({ success: true, phonepePaymentUrl: payData.data.paymentUrl });
    } else {
      console.error("Payment creation failed:", payData);
      res.json({ success: false });
    }
  } catch (err) {
    console.error("Error creating payment:", err);
    res.status(500).json({ error: "Payment creation failed" });
  }
});

// ------------------- DEFAULT ROUTE -------------------
// Serve your HTML form
app.get("/", (req, res) => {
  res.sendFile(path.join(__dirname, "public", "index.html"));
});

// ------------------- START SERVER -------------------
app.listen(PORT, () => {
  console.log(`🚀 Server running on port ${PORT}`);
});
