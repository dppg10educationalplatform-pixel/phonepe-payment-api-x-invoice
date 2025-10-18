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

// ES Modules __dirname
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Serve static files (CSS/JS/images) from public
app.use(express.static(path.join(__dirname, "public")));

// Environment variables
const CLIENT_ID = process.env.CLIENT_ID;
const CLIENT_SECRET = process.env.CLIENT_SECRET;
const REDIRECT_URL = process.env.REDIRECT_URL;
const PORT = process.env.PORT || 5000;

// ------------------- PHONEPE PAYMENT -------------------
app.post("/pay", async (req, res) => {
  try {
    const { amount } = req.body;

    if (!amount) return res.json({ success: false, message: "Amount is required" });

    // Get access token
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
          amount: amount,          // in paise
          expireAfter: 1200,
          paymentFlow: {
            type: "PG_CHECKOUT",
            message: "Admission Fee Payment",
            merchantUrls: { redirectUrl: REDIRECT_URL },
          },
        }),
      }
    );

    const payData = await payResponse.json();

    if (payData?.status === "SUCCESS" || payData?.data?.paymentUrl) {
      res.json({ success: true, phonepePaymentUrl: payData.data.paymentUrl });
    } else {
      console.error("Payment failed:", payData);
      res.json({ success: false, data: payData });
    }
  } catch (err) {
    console.error("Payment error:", err);
    res.status(500).json({ success: false, error: "Payment creation failed" });
  }
});

// ------------------- SERVE HTML -------------------
app.get("/", (req, res) => {
  res.send(`<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>Coaching Admission Form</title>
<style>
body { background-color: #f0f0f0; font-size: 16px; font-family: Arial, sans-serif; padding: 20px; }
#pdf-frame { width: 100%; height: 600px; border: none; display: none; margin-top: 20px; }
form { background: white; padding: 20px; border-radius: 10px; max-width: 900px; margin: auto; box-shadow: 0 0 10px #ccc; display: none; }
button { margin: 10px; padding: 10px 20px; font-size: 16px; background-color: #007BFF; color: white; border: none; border-radius: 6px; cursor: pointer; }
button:hover { background-color: #0056b3; }
label { display: block; margin-bottom: 5px; }
input[type="text"], input[type="email"], input[type="date"], select, textarea, input[type="file"] {
  width: 100%; padding: 10px; font-size: 16px; border: 1px solid #aaa; border-radius: 5px; margin-bottom: 15px;
}
textarea { resize: vertical; }
input[type="submit"] {
  background: #007BFF; color: white; padding: 10px 20px; font-size: 16px; border: none; border-radius: 6px;
  cursor: not-allowed; opacity: 0.6;
}
input[type="submit"].enabled { cursor: pointer; opacity: 1; }
input[type="submit"]:hover.enabled { background-color: #0056b3; }
.thank-you-message { display: none; max-width: 900px; margin: 20px auto; padding: 20px; background-color: #ffffff; border-radius: 10px; text-align: left; word-wrap: break-word; }
.thank-you-message h2 { text-align: center; }
.payment-box { padding: 15px; border: 1px dashed #007BFF; margin: 15px 0; text-align: left; border-radius: 8px; background: #f9f9f9; }
.form-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 20px; }
.full-width { grid-column: 1 / -1; }
#photo-preview { display: none; max-width:150px; border:1px solid #ccc; border-radius:8px; padding:5px; }
#amountLabel { margin-top: 10px; font-weight: bold; color: #333; }
table { width: 100%; border-collapse: collapse; margin-top: 15px; }
table, th, td { border: none; }
th, td { padding: 8px; text-align: left; }
@media (max-width: 768px) {
  body { padding: 10px; font-size: 15px; }
  form { padding: 15px; }
  .form-grid { grid-template-columns: 1fr !important; gap: 15px; }
  input[type="text"], input[type="email"], input[type="date"], select, textarea, input[type="file"] {
    font-size: 16px; padding: 12px;
  }
  button, input[type="submit"] { width: 100%; font-size: 18px; padding: 14px; }
}
@media print { button, a[href], #pdf-frame { display: none !important; } }
</style>
</head>
<body>

<div style="text-align: center;">
  <button type="button" onclick="showPDF()">PROSPECTUS</button>
  <button type="button" onclick="showForm()">Fill Admission Form</button>
</div>

<iframe id="pdf-frame" src="https://drive.google.com/file/d/1we22QTVvt33YMLwMx09HFqXeCB0Iai5a/preview"></iframe>

<form id="admission-form" action="https://formspree.io/f/xkgrbpzp" method="POST">
  <input type="hidden" name="_captcha" value="false">
  <h2>Admission Form</h2>
  <h2>G10 EDUCATIONAL PLATFORM</h2>
  <!-- Form fields here (same as your HTML) -->
  <!-- PAYMENT BUTTON -->
  <div class="full-width payment-box">
    <h3>Pay Admission Fee</h3>
    <button type="button" id="payNowBtn">Pay now</button>
    <div id="amountLabel"></div>
  </div>
  <input type="submit" id="submitBtn" value="Submit" disabled>
</form>

<div class="thank-you-message" id="thank-you">
  <h2>Thank You, <span id="thank-name"></span>!</h2>
  <p>We have received your form for the <strong><span id="thank-course"></span></strong> course.</p>
  <p>A confirmation has been sent to <strong><span id="thank-email"></span></strong>.</p>
  <h3>Your Submitted Form:</h3>
  <table id="submitted-data"></table>
</div>

<script>
// PDF/Form toggle
function showPDF(){document.getElementById('pdf-frame').style.display='block';document.getElementById('admission-form').style.display='none';document.getElementById('thank-you').style.display='none';}
function showForm(){document.getElementById('admission-form').style.display='block';document.getElementById('pdf-frame').style.display='none';document.getElementById('thank-you').style.display='none';}

// Payment
document.getElementById("payNowBtn").addEventListener("click", async ()=>{
  const service=document.querySelector("select[name='service_type']").value; let amount=0;
  if(["HOME TUITION","INDIVIDUAL COACHING","ONLINE COACHING","DUAL COACHING"].includes(service)) amount=4900;
  else if(["GROUP COACHING","SPECIAL GROUP COACHING"].includes(service)) amount=9900;
  if(!amount){alert("Select valid service before payment."); return;}
  const name=document.querySelector("input[name='name']").value.trim();
  const email=document.querySelector("input[name='email']").value.trim();
  if(!name||!email){alert("Enter name & email before payment."); return;}
  try{
    const res=await fetch("/pay",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({amount})});
    const data=await res.json();
    if(data?.success && data.phonepePaymentUrl){localStorage.setItem("paymentDone","true"); const btn=document.getElementById("submitBtn"); btn.disabled=false; btn.classList.add("enabled"); window.location.href=data.phonepePaymentUrl;}
    else{console.error("Payment failed:",data); alert("Failed to create payment.")}
  }catch(err){console.error(err); alert("Error connecting to server.");}
});

window.addEventListener("load",()=>{if(localStorage.getItem("paymentDone")==="true"){const btn=document.getElementById("submitBtn");btn.disabled=false;btn.classList.add("enabled");}});

</script>
</body>
</html>`);
});

// ------------------- START SERVER -------------------
app.listen(PORT, () => {
  console.log(`🚀 Server running on port ${PORT}`);
});
