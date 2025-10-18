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

// Environment variables
const CLIENT_ID = process.env.CLIENT_ID;
const CLIENT_SECRET = process.env.CLIENT_SECRET;
const REDIRECT_URL = process.env.REDIRECT_URL;
const IMGBB_KEY = process.env.IMGBB_KEY; // for photo upload
const PORT = process.env.PORT || 5000;

// ------------------- PHONEPE AUTH -------------------
async function getAccessToken() {
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
  return data.access_token;
}

// ------------------- CREATE PAYMENT -------------------
app.post("/pay", async (req, res) => {
  try {
    const { amount } = req.body;
    const token = await getAccessToken();
    if (!token) return res.json({ success: false });

    const payResponse = await fetch(
      "https://api-preprod.phonepe.com/apis/pg-sandbox/checkout/v2/pay",
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `O-Bearer ${token}`,
        },
        body: JSON.stringify({
          merchantOrderId: "TX" + Date.now(),
          amount: amount || 1000,
          expireAfter: 1200,
          paymentFlow: {
            type: "PG_CHECKOUT",
            message: "Payment for G10 Educational Platform",
            merchantUrls: { redirectUrl: REDIRECT_URL },
          },
        }),
      }
    );

    const payData = await payResponse.json();
    console.log("PhonePe response:", payData);

    if (payData.data?.paymentUrl) {
      res.json({ success: true, phonepePaymentUrl: payData.data.paymentUrl });
    } else {
      res.json({ success: false });
    }
  } catch (err) {
    console.error(err);
    res.status(500).json({ success: false, error: "Payment failed" });
  }
});

// ------------------- PHOTO UPLOAD -------------------
app.post("/upload-photo", async (req, res) => {
  try {
    const { imageBase64 } = req.body;
    if (!imageBase64) return res.json({ success: false });

    const formData = new FormData();
    formData.append("image", imageBase64);

    const imgbbRes = await fetch(`https://api.imgbb.com/1/upload?key=${IMGBB_KEY}`, {
      method: "POST",
      body: formData,
    });
    const data = await imgbbRes.json();
    res.json(data);
  } catch (err) {
    console.error(err);
    res.status(500).json({ success: false });
  }
});

// ------------------- SERVE HTML -------------------
app.get("/", (req, res) => {
  res.send(`<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>G10 Admission Form</title>
<style>
body { font-family: Arial; padding: 20px; background:#f0f0f0;}
form { max-width:900px; margin:auto; background:white; padding:20px; border-radius:10px; }
input, select, textarea { width:100%; padding:10px; margin:5px 0; border-radius:5px; border:1px solid #aaa;}
button, input[type=submit] { padding:10px 20px; background:#007BFF; color:white; border:none; border-radius:6px; cursor:pointer;}
button:hover, input[type=submit]:hover { background:#0056b3; }
#photo-preview { max-width:100px; border-radius:5px; margin-top:10px; }
</style>
</head>
<body>
<h2>G10 Educational Platform Admission Form</h2>
<form id="admission-form">
<label>Full Name:</label><input type="text" name="name" required>
<label>Email:</label><input type="email" name="email" required>
<label>Service Type:</label>
<select name="service_type" required>
<option value="">--Select--</option>
<option>HOME TUITION</option>
<option>INDIVIDUAL COACHING</option>
<option>ONLINE COACHING</option>
<option>DUAL COACHING</option>
<option>GROUP COACHING</option>
<option>SPECIAL GROUP COACHING</option>
</select>
<label>Passport Photo (≤80KB):</label>
<input type="file" id="photo-file" accept="image/*" required>
<img id="photo-preview" src="">
<button type="button" id="payNowBtn">Pay Now</button>
<input type="submit" id="submitBtn" value="Submit" disabled>
</form>

<script>
const payBtn=document.getElementById('payNowBtn');
const submitBtn=document.getElementById('submitBtn');
let validPhoto=false;

document.getElementById('photo-file').addEventListener('change', e=>{
  const file=e.target.files[0];
  const preview=document.getElementById('photo-preview');
  validPhoto=false;
  if(file){
    if(file.size>80*1024){ alert('File too big'); return;}
    validPhoto=true;
    const reader=new FileReader();
    reader.onload=ev=>{ preview.src=ev.target.result; }
    reader.readAsDataURL(file);
  }
});

payBtn.addEventListener('click', async ()=>{
  const form=document.getElementById('admission-form');
  const service=form.service_type.value;
  let amount=0;
  if(["HOME TUITION","INDIVIDUAL COACHING","ONLINE COACHING","DUAL COACHING"].includes(service)) amount=4900;
  else if(["GROUP COACHING","SPECIAL GROUP COACHING"].includes(service)) amount=9900;
  if(!amount){ alert('Select a valid service'); return;}
  try{
    const res=await fetch('/pay',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({amount})});
    const data=await res.json();
    if(data.success && data.phonepePaymentUrl){
      localStorage.setItem('paymentDone','true');
      submitBtn.disabled=false;
      window.location.href=data.phonepePaymentUrl;
    } else alert('Failed to create payment');
  } catch(err){ alert('Payment error'); console.error(err);}
});

document.getElementById('admission-form').addEventListener('submit', async e=>{
  e.preventDefault();
  if(!validPhoto){ alert('Upload valid photo'); return;}
  const file=document.getElementById('photo-file').files[0];
  const reader=new FileReader();
  reader.onload=async ev=>{
    try{
      const res=await fetch('/upload-photo',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({imageBase64:ev.target.result.split(",")[1]})});
      const data=await res.json();
      if(data.success){
        alert('Form submitted successfully!');
      } else alert('Photo upload failed');
    } catch(err){ console.error(err); alert('Error uploading photo'); }
  };
  reader.readAsDataURL(file);
});
</script>
</body>
</html>`);
});

// ------------------- START SERVER -------------------
app.listen(PORT, () => console.log(`🚀 Server running on port ${PORT}`));
